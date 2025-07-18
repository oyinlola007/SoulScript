import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Body
from sqlmodel import func, select, Session
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ChatSession,
    ChatSessionCreate,
    ChatSessionPublic,
    ChatSessionsPublic,
    ChatSessionUpdate,
    ChatMessage,
    ChatMessageCreate,
    ChatMessagePublic,
    ChatMessagesPublic,
    Message,
)
from app.services.chat_service import chat_service
from app.core.db import engine
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=ChatSessionsPublic)
def read_chat_sessions(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 20
) -> Any:
    """
    Retrieve user's chat sessions.
    """
    try:
        chat_sessions = chat_service.get_user_sessions(
            session, current_user.id, skip=skip, limit=limit
        )

        # Get total count
        count_statement = (
            select(func.count())
            .select_from(ChatSession)
            .where(ChatSession.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()

        return ChatSessionsPublic(data=chat_sessions, count=count)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving chat sessions: {str(e)}"
        )


@router.post("/sessions", response_model=ChatSessionPublic)
def create_chat_session(
    *, session: SessionDep, current_user: CurrentUser, session_in: ChatSessionCreate
) -> Any:
    """
    Create new chat session.
    """
    try:
        chat_session = chat_service.create_session(
            session, current_user.id, session_in.title
        )
        return chat_session
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error creating chat session: {str(e)}"
        )


@router.get("/sessions/{session_id}", response_model=ChatSessionPublic)
def read_chat_session(
    session: SessionDep, current_user: CurrentUser, session_id: uuid.UUID
) -> Any:
    """
    Get chat session by ID.
    """
    try:
        statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == current_user.id
        )
        chat_session = session.exec(statement).first()

        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        return chat_session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving chat session: {str(e)}"
        )


@router.put("/sessions/{session_id}", response_model=ChatSessionPublic)
def update_chat_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    session_id: uuid.UUID,
    session_in: ChatSessionUpdate,
) -> Any:
    """
    Update chat session title.
    """
    try:
        if not session_in.title:
            raise HTTPException(status_code=400, detail="Title is required")

        chat_session = chat_service.update_session_title(
            session, session_id, current_user.id, session_in.title
        )
        return chat_session
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating chat session: {str(e)}"
        )


@router.delete("/sessions/{session_id}")
def delete_chat_session(
    session: SessionDep, current_user: CurrentUser, session_id: uuid.UUID
) -> Message:
    """
    Delete a chat session and all its messages.
    """
    try:
        chat_service.delete_session(session, session_id, current_user.id)
        return Message(message="Chat session deleted successfully")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting chat session: {str(e)}"
        )


@router.get("/sessions/{session_id}/messages", response_model=ChatMessagesPublic)
def read_chat_messages(
    session: SessionDep,
    current_user: CurrentUser,
    session_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """
    Get messages for a specific chat session.
    """
    try:
        # Verify session ownership
        session_statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == current_user.id
        )
        chat_session = session.exec(session_statement).first()

        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get messages
        messages = chat_service.get_session_messages(
            session, session_id, skip=skip, limit=limit
        )

        # Get total count
        count_statement = (
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.session_id == session_id)
        )
        count = session.exec(count_statement).one()

        return ChatMessagesPublic(data=messages, count=count)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving messages: {str(e)}"
        )


@router.post("/sessions/{session_id}/messages")
def send_chat_message(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    session_id: uuid.UUID,
    message_in: ChatMessageCreate,
) -> Any:
    """
    Send a message in a chat session and get AI response.
    """
    try:
        # Verify session ownership
        session_statement = select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.owner_id == current_user.id
        )
        chat_session = session.exec(session_statement).first()

        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Send message and get response
        try:
            result = chat_service.send_message(
                session, session_id, current_user.id, message_in.content
            )
        except ValueError as e:
            if "not found" in str(e).lower():
                raise HTTPException(status_code=404, detail="Chat session not found")
            raise

        # Convert SQLModel objects to proper response format
        user_message_public = ChatMessagePublic(
            id=result["user_message"].id,
            content=result["user_message"].content,
            role=result["user_message"].role,
            session_id=result["user_message"].session_id,
            created_at=result["user_message"].created_at,
        )

        ai_message_public = ChatMessagePublic(
            id=result["ai_message"].id,
            content=result["ai_message"].content,
            role=result["ai_message"].role,
            session_id=result["ai_message"].session_id,
            created_at=result["ai_message"].created_at,
        )

        session_public = ChatSessionPublic(
            id=result["session"].id,
            title=result["session"].title,
            is_active=result["session"].is_active,
            owner_id=result["session"].owner_id,
            anon_session_id=result["session"].anon_session_id,
            created_at=result["session"].created_at,
            updated_at=result["session"].updated_at,
            is_blocked=result["session"].is_blocked,
            blocked_reason=result["session"].blocked_reason,
        )

        return {
            "user_message": user_message_public,
            "ai_message": ai_message_public,
            "session": session_public,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error sending chat message: {str(e)}"
        )


@router.get("/sessions/{session_id}/summary")
def get_session_summary(
    session: SessionDep, current_user: CurrentUser, session_id: uuid.UUID
) -> Any:
    """
    Get a summary of a chat session.
    """
    try:
        summary = chat_service.get_session_summary(session, session_id, current_user.id)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error getting session summary: {str(e)}"
        )


@router.post("/test-ai")
async def test_ai_behavior(request: dict, session: SessionDep):
    """
    Test endpoint to verify AI behavior and logging
    """
    try:
        # Create a test user and session
        test_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        test_session_id = uuid.UUID("00000000-0000-0000-0000-000000000002")

        # Create test session if it doesn't exist
        existing_session = session.exec(
            select(ChatSession).where(ChatSession.id == test_session_id)
        ).first()

        if not existing_session:
            existing_session = ChatSession(
                id=test_session_id, owner_id=test_user_id, title="AI Test Session"
            )
            session.add(existing_session)
            session.commit()
            session.refresh(existing_session)

        # Test the chat service
        content = request.get("message", "Hello, how are you?")

        logger.info("=== AI BEHAVIOR TEST START ===")
        result = chat_service.send_message(
            session, test_session_id, test_user_id, content
        )
        logger.info("=== AI BEHAVIOR TEST END ===")

        return {
            "status": "success",
            "message": "AI behavior test completed",
            "user_message": result["user_message"],
            "ai_message": result["ai_message"],
            "session": result["session"],
        }

    except Exception as e:
        logger.error(f"AI behavior test failed: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/sessions/{session_id}/stream")
async def stream_chat_message(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    session_id: uuid.UUID,
    message_in: ChatMessageCreate,
):
    """
    Stream AI response for a chat session.
    """
    # Verify session ownership
    session_statement = select(ChatSession).where(
        ChatSession.id == session_id, ChatSession.owner_id == current_user.id
    )
    chat_session = session.exec(session_statement).first()
    if not chat_session:

        def error_gen():
            yield "Session not found or access denied."

        return StreamingResponse(error_gen(), media_type="text/event-stream")

    # Stream the AI response
    generator = chat_service.stream_message(
        session, session_id, current_user.id, message_in.content
    )
    return StreamingResponse(generator, media_type="text/event-stream")


@router.post("/anon/session", response_model=ChatSessionPublic)
def create_anon_chat_session(
    *,
    session: SessionDep,
    anon_session_id: str = Body(...),
    title: str = Body(default="New Chat"),
) -> Any:
    """
    Create a new anonymous chat session using anon_session_id.
    """
    # Check if a session already exists for this anon_session_id
    statement = select(ChatSession).where(
        ChatSession.anon_session_id == anon_session_id
    )
    chat_session = session.exec(statement).first()
    if chat_session:
        return chat_session
    # Create new session
    chat_session = chat_service.create_session(
        session, anon_session_id=anon_session_id, title=title
    )
    return chat_session


@router.get("/anon/session", response_model=ChatSessionPublic)
def get_anon_chat_session(session: SessionDep, anon_session_id: str) -> Any:
    """
    Get the anonymous chat session for the given anon_session_id.
    """
    sessions = chat_service.get_user_sessions(session, anon_session_id=anon_session_id)
    if not sessions:
        raise HTTPException(status_code=404, detail="Anonymous chat session not found")
    return sessions[0]


@router.get("/anon/session/messages", response_model=ChatMessagesPublic)
def get_anon_chat_messages(
    session: SessionDep, anon_session_id: str, skip: int = 0, limit: int = 20
) -> Any:
    """
    Get messages for the anonymous chat session.
    """
    sessions = chat_service.get_user_sessions(session, anon_session_id=anon_session_id)
    if not sessions:
        raise HTTPException(status_code=404, detail="Anonymous chat session not found")
    chat_session = sessions[0]
    messages = chat_service.get_session_messages(
        session, chat_session.id, skip=skip, limit=limit
    )
    count_statement = (
        select(func.count())
        .select_from(ChatMessage)
        .where(ChatMessage.session_id == chat_session.id)
    )
    count = session.exec(count_statement).one()
    return ChatMessagesPublic(data=messages, count=count)


@router.post("/anon/session/message", response_model=ChatMessagePublic)
def send_anon_chat_message(
    *, session: SessionDep, anon_session_id: str = Body(...), content: str = Body(...)
) -> Any:
    """
    Send a message in the anonymous chat session and get AI response.
    """
    sessions = chat_service.get_user_sessions(session, anon_session_id=anon_session_id)
    if not sessions:
        raise HTTPException(status_code=404, detail="Anonymous chat session not found")
    chat_session = sessions[0]
    result = chat_service.send_message(
        session, chat_session.id, anon_session_id=anon_session_id, content=content
    )
    return result["user_message"]


@router.put("/anon/session/{session_id}", response_model=ChatSessionPublic)
def update_anon_chat_session(
    *,
    session: SessionDep,
    session_id: uuid.UUID,
    session_in: ChatSessionUpdate,
) -> Any:
    """
    Update anonymous chat session title (no authentication required).
    """
    try:
        if not session_in.title:
            raise HTTPException(status_code=400, detail="Title is required")
        # Only allow update if session is anonymous
        chat_session = session.get(ChatSession, session_id)
        if not chat_session or chat_session.owner_id is not None:
            raise HTTPException(
                status_code=404, detail="Anonymous chat session not found"
            )
        chat_session.title = session_in.title
        session.add(chat_session)
        session.commit()
        session.refresh(chat_session)
        return chat_session
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error updating anonymous chat session: {str(e)}"
        )


@router.post("/anon/session/{session_id}/stream")
async def stream_anon_chat_message(
    *,
    session: SessionDep,
    session_id: uuid.UUID,
    message_in: ChatMessageCreate,
):
    """
    Stream AI response for an anonymous chat session (no authentication required).
    """
    # Verify session is anonymous
    chat_session = session.get(ChatSession, session_id)
    if not chat_session or chat_session.owner_id is not None:

        def error_gen():
            yield "Session not found or not anonymous."

        return StreamingResponse(error_gen(), media_type="text/event-stream")
    # Stream the AI response
    generator = chat_service.stream_message(
        session, session_id, None, message_in.content
    )
    return StreamingResponse(generator, media_type="text/event-stream")
