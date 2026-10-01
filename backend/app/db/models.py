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
    Added per Build Brief Section 5 — not in original master documentation schema.
    """
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(512))
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
