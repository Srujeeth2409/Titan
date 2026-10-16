from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.core.log_ingest_auth import verify_log_ingest_key
from app.db.models import LogEvent
from app.db.session import get_db
from app.schemas.log import (
    LogBatchIngestRequest,
    LogBatchIngestResponse,
    LogEventCreate,
    LogEventListResponse,
    LogEventResponse,
)
from app.services.log_ingestion.service import (
    ingest_log_event,
    ingest_log_events_batch,
    normalize_level,
)

router = APIRouter(
    prefix="/logs",
    tags=["logs"],
)


@router.post(
    "/ingest",
    response_model=LogEventResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_log_ingest_key)],
)
async def ingest_log(
    payload: LogEventCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await ingest_log_event(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "TT-4221", "message": str(exc)},
        ) from exc


@router.post(
    "/ingest/batch",
    response_model=LogBatchIngestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_log_ingest_key)],
)
async def ingest_logs_batch(
    payload: LogBatchIngestRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        events = await ingest_log_events_batch(db, payload.events)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "TT-4221", "message": str(exc)},
        ) from exc
    return LogBatchIngestResponse(ingested=len(events), events=events)


@router.get(
    "",
    response_model=LogEventListResponse,
)
async def list_logs(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    source: str | None = Query(default=None, max_length=255),
    service: str | None = Query(default=None, max_length=255),
    level: str | None = Query(default=None, max_length=20),
    environment: str | None = Query(default=None, max_length=100),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    del user  # authenticated read; row-level ACL can be added later

    filters = []
    if source:
        filters.append(LogEvent.source == source)
    if service:
        filters.append(LogEvent.service == service)
    if environment:
        filters.append(LogEvent.environment == environment)
    if level:
        try:
            filters.append(LogEvent.level == normalize_level(level))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "TT-4221", "message": str(exc)},
            ) from exc
    if from_time:
        filters.append(LogEvent.timestamp >= from_time)
    if to_time:
        filters.append(LogEvent.timestamp <= to_time)

    count_stmt = select(func.count()).select_from(LogEvent)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = select(LogEvent).order_by(LogEvent.timestamp.desc()).limit(limit).offset(offset)
    if filters:
        stmt = stmt.where(*filters)
    rows = (await db.execute(stmt)).scalars().all()
    return LogEventListResponse(total=total, items=list(rows))
