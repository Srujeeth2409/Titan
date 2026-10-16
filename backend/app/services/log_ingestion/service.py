"""
Log ingestion pipeline — validate, normalize, and persist log events to PostgreSQL.
"""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LogEvent
from app.schemas.log import LogEventCreate

ALLOWED_LEVELS = frozenset({"DEBUG", "INFO", "WARN", "WARNING", "ERROR", "FATAL", "CRITICAL"})

LEVEL_ALIASES = {
    "WARNING": "WARN",
    "CRITICAL": "FATAL",
}


def normalize_level(level: str) -> str:
    upper = level.strip().upper()
    if upper not in ALLOWED_LEVELS:
        raise ValueError(f"Unsupported log level: {level}")
    return LEVEL_ALIASES.get(upper, upper)


def normalize_timestamp(ts: datetime | None) -> datetime:
    if ts is None:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    if ts.tzinfo is not None:
        return ts.astimezone(timezone.utc).replace(tzinfo=None)
    return ts


def build_log_event(payload: LogEventCreate) -> LogEvent:
    return LogEvent(
        source=payload.source.strip(),
        service=payload.service.strip() if payload.service else None,
        environment=payload.environment.strip() if payload.environment else None,
        level=normalize_level(payload.level),
        message=payload.message,
        timestamp=normalize_timestamp(payload.timestamp),
        log_metadata=payload.metadata,
    )


async def ingest_log_event(db: AsyncSession, payload: LogEventCreate) -> LogEvent:
    event = build_log_event(payload)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def ingest_log_events_batch(
    db: AsyncSession,
    payloads: list[LogEventCreate],
) -> list[LogEvent]:
    events = [build_log_event(p) for p in payloads]
    db.add_all(events)
    await db.commit()
    for event in events:
        await db.refresh(event)
    return events
