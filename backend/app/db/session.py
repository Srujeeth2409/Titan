"""
Async SQLAlchemy engine/session factory.

Titan uses PostgreSQL as the system-of-record for organizations, workspaces,
documents, chunks (metadata only — vectors live in the vector DB),
evaluations, experiments, telemetry rollups, and audit logs. Vector search
itself is delegated to a pluggable vector store client (see
app/services/embedding and app/services/retrieval).
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.postgres_dsn, pool_pre_ping=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
