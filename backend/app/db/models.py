"""
Core relational schema.

This covers the system-of-record tables described in the platform's
database design: organizations, workspaces, users, documents, chunks,
queries, evaluations, experiments, telemetry, and audit logs. Vector
embeddings themselves are stored in the vector database (Qdrant/Milvus/etc);
this table only tracks embedding metadata for joins and lineage.

Auth tables (users, refresh_tokens) were added per Section 5 of the
Antigravity Build Brief — the master documentation's schema (Section 6.3)
didn't originally include them.
"""
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    workspaces: Mapped[list["Workspace"]] = relationship(back_populates="organization")


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[uuid.UUID] = uuid_pk()
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organization: Mapped[Organization] = relationship(back_populates="workspaces")


class User(Base):
    """
    Auth user. Password is hashed with Argon2id (argon2-cffi).
    Added per Build Brief Section 5 — extended for Enterprise Workspace.
    """
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(512))
    full_name: Mapped[str] = mapped_column(String(255), default="Titan Employee")
    department: Mapped[str] = mapped_column(String(100), default="General")
    role: Mapped[str] = mapped_column(String(50), default="Employee")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="online")
    status_message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")


class RefreshToken(Base):
    """
    Stores hashed refresh tokens for rotation and revocation.
    Added per Build Brief Section 5.
    """
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = uuid_pk()
    filename: Mapped[str] = mapped_column(String(512))
    source_type: Mapped[str] = mapped_column(String(50))
    collection: Mapped[str] = mapped_column(String(255), default="default")
    status: Mapped[str] = mapped_column(String(50), default="queued")
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doc_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document")


class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"))
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    strategy: Mapped[str] = mapped_column(String(50))
    token_count: Mapped[int] = mapped_column(Integer)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vector_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    document: Mapped[Document] = relationship(back_populates="chunks")


class QueryLog(Base):
    __tablename__ = "query_logs"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    query_text: Mapped[str] = mapped_column(Text)
    strategy: Mapped[str] = mapped_column(String(50))
    latency_ms: Mapped[float] = mapped_column(Float)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """
    Security audit log — records login attempts (success and failure),
    token refresh events, and other security-relevant actions per Build Brief §5.
    """
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = uuid_pk()
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100))
    resource: Mapped[str] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class LogEvent(Base):
    __tablename__ = "log_events"

    id: Mapped[uuid.UUID] = uuid_pk()

    source: Mapped[str] = mapped_column(String(255), index=True)
    service: Mapped[str | None] = mapped_column(String(255), nullable=True)
    environment: Mapped[str | None] = mapped_column(String(100), nullable=True)

    level: Mapped[str] = mapped_column(String(20), index=True)
    message: Mapped[str] = mapped_column(Text)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )

    log_metadata: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


# ============================================================================
# Enterprise Workspace Models
# ============================================================================

class Email(Base):
    __tablename__ = "emails"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sender_email: Mapped[str] = mapped_column(String(255), index=True)
    sender_name: Mapped[str] = mapped_column(String(255))
    recipient_emails: Mapped[list] = mapped_column(JSON, default=list)
    cc_emails: Mapped[list] = mapped_column(JSON, default=list)
    bcc_emails: Mapped[list] = mapped_column(JSON, default=list)
    subject: Mapped[str] = mapped_column(String(512), default="(No Subject)")
    body_text: Mapped[str] = mapped_column(Text, default="")
    body_html: Mapped[str] = mapped_column(Text, default="")
    folder: Mapped[str] = mapped_column(String(50), default="inbox", index=True)  # inbox, sent, drafts, archive, trash
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ChatChannel(Base):
    __tablename__ = "chat_channels"
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255))
    channel_type: Mapped[str] = mapped_column(String(50), default="group")  # direct, group, department
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="channel", cascade="all, delete-orphan")


class ChatMember(Base):
    __tablename__ = "chat_members"
    id: Mapped[uuid.UUID] = uuid_pk()
    channel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[uuid.UUID] = uuid_pk()
    channel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_channels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sender_name: Mapped[str] = mapped_column(String(255))
    message_text: Mapped[str] = mapped_column(Text)
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    reactions: Mapped[dict] = mapped_column(JSON, default=dict)
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    channel: Mapped[ChatChannel] = relationship(back_populates="messages")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    is_all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recurrence: Mapped[str] = mapped_column(String(50), default="none")  # none, daily, weekly, monthly
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    attendees: Mapped[list] = mapped_column(JSON, default=list)
    meeting_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[uuid.UUID] = uuid_pk()
    room_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    host_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    host_name: Mapped[str] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    action_items: Mapped[list] = mapped_column(JSON, default=list)
    participant_history: Mapped[list] = mapped_column(JSON, default=list)
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WorkspaceFile(Base):
    __tablename__ = "workspace_files"
    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), index=True)
    folder_path: Mapped[str] = mapped_column(String(512), default="/", index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/octet-stream")
    storage_path: Mapped[str] = mapped_column(String(1024))
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    department: Mapped[str] = mapped_column(String(100), default="General", index=True)
    access_level: Mapped[str] = mapped_column(String(50), default="internal")  # public, internal, confidential, restricted
    version: Mapped[int] = mapped_column(Integer, default=1)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaskItem(Base):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = uuid_pk()
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    creator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assignee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str] = mapped_column(String(100), default="General", index=True)
    priority: Mapped[str] = mapped_column(String(50), default="medium")  # low, medium, high, urgent
    status: Mapped[str] = mapped_column(String(50), default="todo", index=True)  # todo, in_progress, in_review, completed
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class QuickNote(Base):
    __tablename__ = "quick_notes"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="Untitled Note")
    content: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(50), default="blue")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[uuid.UUID] = uuid_pk()
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_name: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    department: Mapped[str] = mapped_column(String(100), default="All", index=True)
    priority: Mapped[str] = mapped_column(String(50), default="normal")  # normal, important, urgent
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(50), default="system")  # mail, chat, calendar, task, system
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
