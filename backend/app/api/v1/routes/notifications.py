"""
Enterprise Notifications API routes for Titan.
Handles alerts, unread counts, status transitions, and cross-app action notifications.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Notification
from app.db.session import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    user: CurrentUser,
    limit: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

    unread_stmt = select(func.count(Notification.id)).where(
        Notification.user_id == user.id, Notification.is_read == False
    )
    unread_count = (await db.execute(unread_stmt)).scalar() or 0

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        nid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification ID")

    stmt = select(Notification).where(Notification.id == nid, Notification.user_id == user.id)
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()

    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}

