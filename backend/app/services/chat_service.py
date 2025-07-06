import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from langchain_openai import ChatOpenAI
from langchain.prompts import (
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
    ChatPromptTemplate,
)
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from pydantic import BaseModel, Field
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.memory import ConversationSummaryBufferMemory
from sqlmodel import Session, select
from app.models import ChatSession, ChatMessage, User
from app.core.config import settings
from app.core.db import engine
from app.services.content_filter_service import content_filter_service
from app.services.feature_flag_service import feature_flag_service
from app.core.prompts import (
    CHAT_SYSTEM_PROMPT,
    CONVERSATION_SUMMARY_SYSTEM_PROMPT,
    CONVERSATION_SUMMARY_HUMAN_PROMPT,
    BLOCKED_CONTENT_MESSAGE,
    AI_RESPONSE_BLOCKED_MESSAGE,
    BLOCKED_SESSION_DELETE_ERROR,
)

# Set up logging
logger = logging.getLogger(__name__)


class ConversationSummaryBufferMessageHistory(BaseChatMessageHistory, BaseModel):
    """Custom message history that implements ConversationSummaryBufferMemory with database persistence"""

    messages: list[BaseMessage] = Field(default_factory=list)
    llm: ChatOpenAI = Field(default_factory=ChatOpenAI)
    k: int = Field(default=6)  # Keep last 6 messages (3 pairs)
    session_id: str = Field(default="")

    def __init__(
        self, session_id: str, db_session: Session, llm: ChatOpenAI, k: int = 6
    ):
        super().__init__()
        self.session_id = session_id
        self._db_session = db_session  # Use private variable to avoid serialization
        self.llm = llm
        self.k = k
        self.messages = []

        # Load existing summary and messages from database
        self._load_from_database()

    def _get_db_session(self) -> Session:
        """Get database session, creating a new one if needed"""
        if not hasattr(self, "_db_session") or self._db_session is None:
            self._db_session = Session(engine)
        return self._db_session

    def _load_from_database(self):
        """Load existing summary and messages from database"""
        try:
            session = self._get_db_session().get(ChatSession, self.session_id)
            if not session:
                return

            # Load existing summary if available
            if session.conversation_summary:
                self.messages.append(
                    SystemMessage(content=session.conversation_summary)
                )
                logger.info(f"Loaded existing summary for session {self.session_id}")

            # Load recent messages
            recent_messages = (
                self._get_db_session()
                .exec(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == self.session_id)
                    .order_by(ChatMessage.created_at.desc())
                    .limit(self.k)
                )
                .all()
            )

            # Add messages in chronological order
            for msg in reversed(recent_messages):
                if msg.role == "user":
                    from langchain_core.messages import HumanMessage

                    self.messages.append(HumanMessage(content=msg.content))
                else:
                    from langchain_core.messages import AIMessage

                    self.messages.append(AIMessage(content=msg.content))

            logger.info(
                f"Loaded {len(recent_messages)} recent messages for session {self.session_id}"
            )
        except Exception as e:
            logger.error(f"Error loading from database: {e}")

    def add_messages(self, messages: list[BaseMessage]) -> None:
        """Add messages to the history, implementing ConversationSummaryBufferMemory logic"""
        try:
            existing_summary: SystemMessage | None = None
            old_messages: list[BaseMessage] | None = None

            # Check if we already have a summary message
            if len(self.messages) > 0 and isinstance(self.messages[0], SystemMessage):
                logger.info("Found existing summary")
                existing_summary = self.messages.pop(0)

            # Add the new messages to the history
            self.messages.extend(messages)

            # Check if we have too many messages
            if len(self.messages) > self.k:
                logger.info(
                    f"Found {len(self.messages)} messages, dropping oldest {len(self.messages) - self.k} messages"
                )
                # Pull out the oldest messages...
                old_messages = self.messages[: len(self.messages) - self.k]
                # ...and keep only the most recent messages
                self.messages = self.messages[-self.k :]

            if old_messages is None:
                logger.info("No old messages to update summary with")
                return

            # Construct the summary chat messages
            summary_prompt = ChatPromptTemplate.from_messages(
                [
                    SystemMessagePromptTemplate.from_template(
                        CONVERSATION_SUMMARY_SYSTEM_PROMPT
                    ),
                    HumanMessagePromptTemplate.from_template(
                        CONVERSATION_SUMMARY_HUMAN_PROMPT
                    ),
                ]
            )

            # Format the messages and invoke the LLM
            new_summary = self.llm.invoke(
                summary_prompt.format_messages(
                    existing_summary=(
                        existing_summary.content
                        if existing_summary
                        else "No previous summary"
                    ),
                    old_messages=old_messages,
                )
            )
            logger.info(f"Generated new summary: {new_summary.content[:100]}...")

            # Save summary to database
            self._save_summary_to_database(new_summary.content)

            # Prepend the new summary to the history
            self.messages = [SystemMessage(content=new_summary.content)] + self.messages

        except Exception as e:
            logger.error(f"Error in add_messages: {e}")

    def _save_summary_to_database(self, summary: str):
        """Save summary to database"""
        try:
            session = self._get_db_session().get(ChatSession, self.session_id)
            if session:
                session.conversation_summary = summary
                session.summary_updated_at = datetime.utcnow()

                # Get the latest message ID
                latest_message = (
                    self._get_db_session()
                    .exec(
                        select(ChatMessage)
                        .where(ChatMessage.session_id == self.session_id)
                        .order_by(ChatMessage.created_at.desc())
                    )
                    .first()
                )

                if latest_message:
                    session.last_summary_message_id = str(latest_message.id)

                self._get_db_session().commit()
                logger.info(f"Saved summary to database for session {self.session_id}")
        except Exception as e:
            logger.error(f"Failed to save summary to database: {e}")

    def add_message(self, message: BaseMessage) -> None:
        """Add a single message to the history"""
        self.add_messages([message])

    def clear(self) -> None:
        """Clear the history"""
        self.messages = []
        # Clear summary in database
        try:
            session = self._get_db_session().get(ChatSession, self.session_id)
            if session:
                session.conversation_summary = ""
                session.last_summary_message_id = ""
                self._get_db_session().commit()
        except Exception as e:
            logger.error(f"Failed to clear summary in database: {e}")


class ChatService:
    def __init__(self):
        # Check if OpenAI API key is available
        if not settings.OPENAI_API_KEY:
            logger.warning(
                "OpenAI API key not found. Chat functionality will be limited."
            )
            self.llm = None
            self.embedding = None
        else:
            try:
                # Initialize OpenAI LLM
                self.llm = ChatOpenAI(
                    temperature=0.0,
                    model="gpt-4o-mini",
                    openai_api_key=settings.OPENAI_API_KEY,
                )
                logger.info("OpenAI LLM initialized successfully")

                # Initialize OpenAI embeddings
                self.embedding = OpenAIEmbeddings(
                    openai_api_key=settings.OPENAI_API_KEY
                )
                logger.info("OpenAI embeddings initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI components: {e}")
                self.llm = None
                self.embedding = None

        # Initialize ChromaDB for PDF context retrieval
        self.persist_directory = "/app/chroma_db"
        self.vectordb = self._get_or_create_vectordb()

        # Initialize chat memory map
        self.chat_memory_map = {}

        # Initialize the chat pipeline
        self.chat_pipeline = self._create_chat_pipeline()

    def _get_or_create_vectordb(self) -> Optional[Chroma]:
        """Get existing vector store or create new one"""
        if not self.embedding:
            logger.warning(
                "No embedding function available. ChromaDB will not be initialized."
            )
            return None

        try:
            # Try to load existing vector store
            vectordb = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding,
            )
            logger.info("ChromaDB vector store loaded successfully")
            return vectordb
        except Exception as e:
            logger.error(f"Failed to load existing ChromaDB: {e}")
            return None

    def _create_chat_pipeline(self):
        """Create the chat pipeline without RunnableWithMessageHistory to avoid serialization issues"""
        if not self.llm:
            logger.warning("No LLM available. Chat pipeline cannot be created.")
            return None

        # Create prompt template that includes memory
        prompt_template = ChatPromptTemplate.from_messages(
            [
                SystemMessagePromptTemplate.from_template(CHAT_SYSTEM_PROMPT),
                MessagesPlaceholder(variable_name="history"),
                HumanMessagePromptTemplate.from_template("{query}"),
            ]
        )

        # Create simple pipeline without message history
        pipeline = prompt_template | self.llm

        return pipeline

    def _get_session_history(
        self, session_id: str
    ) -> ConversationSummaryBufferMessageHistory:
        """Get session history for the LangChain pipeline"""
        # This method is no longer used but kept for compatibility
        db_session = Session(engine)
        return ConversationSummaryBufferMessageHistory(
            session_id=session_id,
            db_session=db_session,
            llm=self.llm,
            k=6,  # Keep last 6 messages (3 pairs)
        )

    def _get_chat_history(
        self, session_id: str, db_session: Session
    ) -> ConversationSummaryBufferMessageHistory:
        """Get or create chat history for a session with persistent summary storage"""
        if session_id not in self.chat_memory_map:
            # Create new persistent memory
            self.chat_memory_map[session_id] = ConversationSummaryBufferMessageHistory(
                session_id, db_session, self.llm
            )
            logger.info(f"Created new persistent memory for session {session_id}")
        else:
            # Update the database session for existing memory
            self.chat_memory_map[session_id]._db_session = db_session
            current_messages = len(self.chat_memory_map[session_id].messages)
            logger.info(
                f"Retrieved existing persistent memory for session {session_id} with {current_messages} messages"
            )

        return self.chat_memory_map[session_id]

    def _get_pdf_context(self, user_id: uuid.UUID, query: str, limit: int = 3) -> str:
        """Get relevant PDF context for the user's query - Global access to all PDFs"""
        if not self.vectordb:
            logger.info(f"No vector database available for user {user_id}")
            return ""

        try:
            logger.info(
                f"Searching PDF context for user {user_id} with query: '{query[:100]}...'"
            )
            logger.info(
                f"Vector DB search parameters: limit={limit} (GLOBAL ACCESS - no user filtering)"
            )

            # Create retriever with global access (no owner_id filtering)
            retriever = self.vectordb.as_retriever(search_kwargs={"k": limit})

            # Get relevant documents from all PDFs
            docs = retriever.get_relevant_documents(query)

            logger.info(
                f"Vector DB returned {len(docs)} documents (global access) for user {user_id}"
            )

            if not docs:
                logger.info(
                    f"No relevant documents found in global PDF database for user {user_id}"
                )
                return ""

            # Log document details
            for i, doc in enumerate(docs):
                title = doc.metadata.get("pdf_title", "Unknown")
                owner_id = doc.metadata.get("owner_id", "Unknown")
                content_preview = (
                    doc.page_content[:100] + "..."
                    if len(doc.page_content) > 100
                    else doc.page_content
                )
                logger.info(
                    f"Document {i+1}: '{title}' (Owner: {owner_id}) - Content preview: '{content_preview}'"
                )

            # Format context
            context_parts = []
            for doc in docs:
                title = doc.metadata.get("pdf_title", "Unknown")
                content = doc.page_content[:500]  # Limit content length
                context_parts.append(f"From '{title}': {content}")

            final_context = "\n\n".join(context_parts)
            logger.info(f"Final PDF context length: {len(final_context)} characters")

            return final_context

        except Exception as e:
            logger.error(f"Error retrieving PDF context for user {user_id}: {e}")
            return ""

    def create_session(
        self, db: Session, user_id: uuid.UUID, title: str = "New Chat"
    ) -> ChatSession:
        """Create a new chat session"""
        session = ChatSession(owner_id=user_id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(f"Created new chat session: {session.id}")
        return session

    def get_user_sessions(
        self, db: Session, user_id: uuid.UUID, skip: int = 0, limit: int = 20
    ) -> List[ChatSession]:
        """Get all chat sessions for a user"""
        statement = (
            select(ChatSession)
            .where(ChatSession.owner_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )

        sessions = db.exec(statement).all()
        return sessions

    def get_session_messages(
        self, db: Session, session_id: uuid.UUID, skip: int = 0, limit: int = 20
    ) -> List[ChatMessage]:
        """Get messages for a specific session"""
        statement = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .offset(skip)
            .limit(limit)
        )

        messages = db.exec(statement).all()
        return messages

    def send_message(
        self, db: Session, session_id: uuid.UUID, user_id: uuid.UUID, content: str
    ) -> Dict[str, Any]:
        """Send a message and get AI response"""
        try:
            logger.info(
                f"=== START: Processing message for session {session_id}, user {user_id} ==="
            )
            logger.info(
                f"User message: '{content[:100]}{'...' if len(content) > 100 else ''}'"
            )

            # Get the session
            session_statement = select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.owner_id == user_id
            )
            session = db.exec(session_statement).first()

            if not session:
                logger.error(
                    f"Session {session_id} not found or access denied for user {user_id}"
                )
                raise ValueError("Session not found or access denied")

            logger.info(
                f"Found session: '{session.title}' (created: {session.created_at})"
            )

            # Check if session is blocked
            if session.is_blocked:
                logger.warning(
                    f"Chat session {session_id} is blocked due to: {session.blocked_reason}"
                )
                raise ValueError("Chat session is blocked due to inappropriate content")

            # Content filtering for user input
            logger.info("=== STEP 0: Content filtering for user input ===")
            filter_result = content_filter_service.filter_content(
                content=content,
                user_id=user_id,
                session_id=session_id,
                content_type="user_input",
            )

            if not filter_result["is_allowed"]:
                # Log the violation
                content_filter_service.log_violation(
                    db=db,
                    user_id=user_id,
                    session_id=session_id,
                    content_type="user_input",
                    original_content=content,
                    blocked_reason=filter_result["blocked_reason"],
                )

                # Block the chat session
                content_filter_service.block_chat_session(
                    db=db,
                    session_id=session_id,
                    blocked_reason=filter_result["blocked_reason"],
                )

                logger.error(
                    f"Content blocked for user {user_id}: {filter_result['blocked_reason']}"
                )
                raise ValueError(f"Content blocked: {filter_result['blocked_reason']}")

            # Save user message (only if content is allowed)
            user_message = ChatMessage(
                session_id=session_id, content=content, role="user"
            )
            db.add(user_message)
            db.commit()
            db.refresh(user_message)
            logger.info(f"Saved user message with ID: {user_message.id}")

            # Get AI response
            if not self.chat_pipeline:
                logger.error("Chat pipeline not available")
                raise ValueError("Chat pipeline not available")

            # Get current chat history
            chat_history = self._get_chat_history(str(session_id), db)
            logger.info(
                f"Current chat history has {len(chat_history.messages)} messages"
            )

            # Log the last few messages for context
            if chat_history.messages:
                logger.info("Recent conversation context:")
                for i, msg in enumerate(chat_history.messages[-4:]):  # Last 4 messages
                    role = (
                        "User"
                        if hasattr(msg, "content")
                        and hasattr(msg, "type")
                        and msg.type == "human"
                        else "AI"
                    )
                    content_preview = (
                        msg.content[:50] + "..."
                        if len(msg.content) > 50
                        else msg.content
                    )
                    logger.info(f"  {role}: '{content_preview}'")

            # Get PDF context for the query
            logger.info("=== STEP 1: Retrieving PDF context ===")
            pdf_context = self._get_pdf_context(user_id, content)

            if pdf_context:
                logger.info(
                    f"PDF context retrieved successfully ({len(pdf_context)} characters)"
                )
            else:
                logger.info(
                    "No PDF context found - proceeding with general knowledge only"
                )

            # Get active feature flags for AI prompt
            logger.info("=== STEP 1.5: Getting active feature flags ===")
            active_flags_prompt = feature_flag_service.get_active_flags_prompt_text(db)

            # Prepare query with context and feature flags
            enhanced_query = content
            if pdf_context:
                enhanced_query = f"Context from your documents:\n{pdf_context}\n\nUser question: {content}\n\nPlease search the provided context and cite specific passages when answering."
                logger.info(f"Enhanced query prepared with PDF context")
            else:
                logger.info("Using original query without PDF context")

            # Add feature flags to the query if any are active
            if active_flags_prompt:
                enhanced_query = f"{active_flags_prompt}\n\n{enhanced_query}"
                logger.info("Enhanced query with active feature flags")
            else:
                logger.info("No active feature flags found")

            # Add the user message to history
            from langchain_core.messages import HumanMessage

            user_langchain_message = HumanMessage(content=content)
            chat_history.add_message(user_langchain_message)

            # Prepare messages for the pipeline
            messages = chat_history.messages.copy()

            # Get AI response using the pipeline
            logger.info("=== STEP 2: Generating AI response ===")

            # Use the simple pipeline without message history
            response = self.chat_pipeline.invoke(
                {"query": enhanced_query, "history": messages}
            )

            # Extract response content
            ai_content = (
                response.content if hasattr(response, "content") else str(response)
            )
            logger.info(f"AI response generated ({len(ai_content)} characters)")
            logger.info(
                f"AI response preview: '{ai_content[:200]}{'...' if len(ai_content) > 200 else ''}'"
            )

            # Content filtering for AI response
            logger.info("=== STEP 3: Content filtering for AI response ===")
            ai_filter_result = content_filter_service.filter_content(
                content=ai_content,
                user_id=user_id,
                session_id=session_id,
                content_type="ai_response",
            )

            if not ai_filter_result["is_allowed"]:
                # Log the violation
                content_filter_service.log_violation(
                    db=db,
                    user_id=user_id,
                    session_id=session_id,
                    content_type="ai_response",
                    original_content=ai_content,
                    blocked_reason=ai_filter_result["blocked_reason"],
                )

                # Block the chat session
                content_filter_service.block_chat_session(
                    db=db,
                    session_id=session_id,
                    blocked_reason=ai_filter_result["blocked_reason"],
                )

                # Replace AI content with blocked message
                ai_content = AI_RESPONSE_BLOCKED_MESSAGE
                logger.warning(
                    f"AI response blocked for user {user_id}: {ai_filter_result['blocked_reason']}"
                )

            # Add the AI response to history
            from langchain_core.messages import AIMessage

            ai_langchain_message = AIMessage(content=ai_content)
            chat_history.add_message(ai_langchain_message)

            # Save AI message
            ai_message = ChatMessage(
                session_id=session_id, content=ai_content, role="assistant"
            )
            db.add(ai_message)

            # Update session timestamp
            session.updated_at = datetime.utcnow()

            # Auto-generate title if it's the first message
            if session.title == "New Chat":
                # Generate a title based on the first message
                title = content[:50] + "..." if len(content) > 50 else content
                session.title = title
                logger.info(f"Auto-generated session title: '{title}'")

            db.commit()
            db.refresh(ai_message)
            logger.info(f"Saved AI message with ID: {ai_message.id}")
            logger.info(f"=== END: Message processing completed successfully ===")

            return {
                "user_message": user_message,
                "ai_message": ai_message,
                "session": session,
            }

        except Exception as e:
            logger.error(
                f"=== ERROR: Failed to process message for session {session_id} ==="
            )
            logger.error(f"Error details: {e}")
            db.rollback()
            raise

    def update_session_title(
        self, db: Session, session_id: uuid.UUID, user_id: uuid.UUID, title: str
    ) -> ChatSession:
        """Update the title of a chat session"""
        statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == user_id
        )
        session = db.exec(statement).first()

        if not session:
            raise ValueError("Session not found or access denied")

        session.title = title
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)

        return session

    def delete_session(
        self, db: Session, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Delete a chat session and all its messages"""
        statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == user_id
        )
        session = db.exec(statement).first()

        if not session:
            raise ValueError("Session not found or access denied")

            # Check if session is blocked
            if session.is_blocked:
                raise ValueError(BLOCKED_SESSION_DELETE_ERROR)

        # Delete session (messages will be cascade deleted)
        db.delete(session)
        db.commit()

        # Clean up memory
        if str(session_id) in self.chat_memory_map:
            del self.chat_memory_map[str(session_id)]

        logger.info(f"Deleted chat session: {session_id}")
        return True

    def get_session_summary(
        self, db: Session, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> Dict[str, Any]:
        """Get a summary of a chat session"""
        # Get session
        session_statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == user_id
        )
        session = db.exec(session_statement).first()

        if not session:
            raise ValueError("Session not found or access denied")

        # Get message count
        message_statement = select(ChatMessage).where(
            ChatMessage.session_id == session_id
        )
        messages = db.exec(message_statement).all()

        return {
            "session": session,
            "message_count": len(messages),
            "last_message": messages[-1] if messages else None,
        }


# Global instance
chat_service = ChatService()
