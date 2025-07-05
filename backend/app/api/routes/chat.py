import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

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


@router.post("/sessions/{session_id}/messages", response_model=dict)
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
        result = chat_service.send_message(
            session, session_id, current_user.id, message_in.content
        )

        return {
            "user_message": result["user_message"],
            "ai_message": result["ai_message"],
            "session": result["session"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")


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
