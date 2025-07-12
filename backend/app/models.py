import uuid
from datetime import datetime
from typing import Dict, Any

from pydantic import EmailStr
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import JSON as SQLJSON


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    pdf_documents: list["PDFDocument"] = Relationship(
        back_populates="owner", cascade_delete=True
    )
    chat_sessions: list["ChatSession"] = Relationship(
        back_populates="owner", cascade_delete=True
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)


# PDF Document Models
class PDFDocumentBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    filename: str = Field(max_length=255)
    file_size: int = Field(ge=0)
    page_count: int = Field(ge=0)
    is_processed: bool = Field(default=False)
    processing_status: str = Field(
        default="pending", max_length=50
    )  # pending, processing, completed, failed
    error_message: str | None = Field(default=None, max_length=1000)


class PDFDocumentCreate(PDFDocumentBase):
    pass


class PDFDocumentUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)


class PDFDocument(PDFDocumentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="pdf_documents")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PDFDocumentPublic(PDFDocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class PDFDocumentsPublic(SQLModel):
    data: list[PDFDocumentPublic]
    count: int


# Chat Models
class ChatSessionBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    is_active: bool = Field(default=True)


class ChatSessionCreate(ChatSessionBase):
    pass


class ChatSessionUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)


class ChatSession(ChatSessionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="chat_sessions")
    messages: list["ChatMessage"] = Relationship(
        back_populates="session", cascade_delete=True
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Summary fields for ConversationSummaryBufferMemory
    conversation_summary: str = Field(default="", max_length=5000)
    summary_updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_summary_message_id: str = Field(default="")

    # Content filtering fields
    is_blocked: bool = Field(default=False)
    blocked_reason: str = Field(default="", max_length=500)


class ChatSessionPublic(ChatSessionBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    is_blocked: bool = Field(default=False)
    blocked_reason: str = Field(default="", max_length=500)


class ChatSessionsPublic(SQLModel):
    data: list[ChatSessionPublic]
    count: int


class ChatMessageBase(SQLModel):
    content: str = Field(min_length=1)
    role: str = Field(max_length=20)  # "user" or "assistant"


class ChatMessageCreate(SQLModel):
    content: str = Field(min_length=1)
    role: str = Field(default="user", max_length=20)  # "user" or "assistant"


class ChatMessage(ChatMessageBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(
        foreign_key="chatsession.id", nullable=False, ondelete="CASCADE"
    )
    session: ChatSession | None = Relationship(back_populates="messages")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessagePublic(ChatMessageBase):
    id: uuid.UUID
    session_id: uuid.UUID
    created_at: datetime


class ChatMessagesPublic(SQLModel):
    data: list[ChatMessagePublic]
    count: int


# Content Filter Models
class ContentFilterLogBase(SQLModel):
    content_type: str = Field(max_length=20)  # "user_input" or "ai_response"
    original_content: str = Field(max_length=10000)
    blocked_reason: str = Field(max_length=500)


class ContentFilterLog(ContentFilterLogBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    session_id: uuid.UUID = Field(
        foreign_key="chatsession.id", nullable=True, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ContentFilterLogPublic(ContentFilterLogBase):
    id: uuid.UUID
    user_id: uuid.UUID
    session_id: uuid.UUID | None
    created_at: datetime


class ContentFilterLogsPublic(SQLModel):
    data: list[ContentFilterLogPublic]
    count: int


# Feature Flag Models
class FeatureFlagBase(SQLModel):
    name: str = Field(unique=True, max_length=100)
    description: str = Field(max_length=1000)
    is_enabled: bool = Field(default=False)
    is_predefined: bool = Field(default=False)


class FeatureFlagCreate(FeatureFlagBase):
    pass


class FeatureFlagUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    is_enabled: bool | None = Field(default=None)


class FeatureFlag(FeatureFlagBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FeatureFlagPublic(FeatureFlagBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class FeatureFlagsPublic(SQLModel):
    data: list[FeatureFlagPublic]
    count: int
