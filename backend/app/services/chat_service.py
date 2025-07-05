import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.prompts import (
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
    ChatPromptTemplate,
)
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain.memory import ConversationSummaryBufferMemory
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from sqlmodel import Session, select
from app.models import ChatSession, ChatMessage, User
from app.core.config import settings

# Set up logging
logger = logging.getLogger(__name__)


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
        """Create the chat pipeline with memory"""
        if not self.llm:
            logger.warning("No LLM available. Chat pipeline cannot be created.")
            return None

        # Create system prompt
        system_prompt = """You are a helpful AI assistant for SoulScript. You have access to the user's uploaded PDF documents and can provide information based on their content. 

When answering questions:
1. Use the context from the user's PDF documents when relevant
2. Be conversational and helpful
3. If you don't know something, say so honestly
4. Keep responses concise but informative
5. Maintain context from the conversation history"""

        # Create prompt template
        prompt_template = ChatPromptTemplate.from_messages(
            [
                SystemMessagePromptTemplate.from_template(system_prompt),
                MessagesPlaceholder(variable_name="history"),
                HumanMessagePromptTemplate.from_template("{query}"),
            ]
        )

        # Create pipeline
        pipeline = prompt_template | self.llm

        # Create pipeline with message history
        pipeline_with_history = RunnableWithMessageHistory(
            pipeline,
            get_session_history=self._get_chat_history,
            input_messages_key="query",
            history_messages_key="history",
        )

        return pipeline_with_history

    def _get_chat_history(self, session_id: str) -> InMemoryChatMessageHistory:
        """Get chat history for a session"""
        if session_id not in self.chat_memory_map:
            self.chat_memory_map[session_id] = InMemoryChatMessageHistory()
        return self.chat_memory_map[session_id]

    def _get_pdf_context(self, user_id: uuid.UUID, query: str, limit: int = 3) -> str:
        """Get relevant PDF context for the user's query"""
        if not self.vectordb:
            return ""

        try:
            # Create retriever with user-specific filtering
            retriever = self.vectordb.as_retriever(
                search_kwargs={"k": limit, "filter": {"owner_id": str(user_id)}}
            )

            # Get relevant documents
            docs = retriever.get_relevant_documents(query)

            if not docs:
                return ""

            # Format context
            context_parts = []
            for doc in docs:
                title = doc.metadata.get("pdf_title", "Unknown")
                content = doc.page_content[:500]  # Limit content length
                context_parts.append(f"From '{title}': {content}")

            return "\n\n".join(context_parts)

        except Exception as e:
            logger.error(f"Error retrieving PDF context: {e}")
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
            # Get the session
            session_statement = select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.owner_id == user_id
            )
            session = db.exec(session_statement).first()

            if not session:
                raise ValueError("Session not found or access denied")

            # Save user message
            user_message = ChatMessage(
                session_id=session_id, content=content, role="user"
            )
            db.add(user_message)
            db.commit()
            db.refresh(user_message)

            # Get AI response
            if not self.chat_pipeline:
                raise ValueError("Chat pipeline not available")

            # Get PDF context for the query
            pdf_context = self._get_pdf_context(user_id, content)

            # Prepare query with context
            enhanced_query = content
            if pdf_context:
                enhanced_query = f"Context from your documents:\n{pdf_context}\n\nUser question: {content}"

            # Get AI response using the pipeline
            response = self.chat_pipeline.invoke(
                {"query": enhanced_query}, config={"session_id": str(session_id)}
            )

            # Extract response content
            ai_content = (
                response.content if hasattr(response, "content") else str(response)
            )

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

            db.commit()
            db.refresh(ai_message)

            return {
                "user_message": user_message,
                "ai_message": ai_message,
                "session": session,
            }

        except Exception as e:
            logger.error(f"Error sending message: {e}")
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
