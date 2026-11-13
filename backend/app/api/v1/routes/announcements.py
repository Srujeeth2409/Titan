"""
Enterprise Announcements API routes for Titan.
Handles company-wide and department announcements, alerts, and priority banners.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Announcement
from app.db.session import get_db

router = APIRouter(prefix="/announcements", tags=["announcements"])


class CreateAnnouncementRequest(BaseModel):
    title: str
    content: str
    department: str = "All"
    priority: str = "normal"  # normal, important, urgent


@router.get("")
async def list_announcements(
    user: CurrentUser,
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Announcement)
        .where(
            or_(
                Announcement.department == "All",
                Announcement.department == user.department,
            )
        )
        .order_by(Announcement.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    items = res.scalars().all()

    # Seed initial company announcements if empty
    if len(items) == 0:
        samples = [
            ("Titan Workspace 2.0 Deployment Complete", "All systems including Mail, Chat, Meetings, Tasks, and RAG are now operating on-premises in our air-gapped infrastructure.", "All", "important"),
            ("Q4 All-Hands Meeting & Strategy Review", "Join leadership next Thursday at 2:00 PM for company milestones, product roadmap, and department recognitions.", "All", "normal"),
            ("Scheduled Maintenance Window", "Routine database index optimization will occur this Saturday from 02:00 to 03:00 UTC. No disruption expected.", "All", "normal"),
        ]
        author_name = user.full_name or "Titan Leadership"
        for t, c, d, p in samples:
            ann = Announcement(
                author_id=user.id,
                author_name=author_name,
                title=t,
                content=c,
                department=d,
                priority=p,
            )
            db.add(ann)
        await db.commit()
        res = await db.execute(stmt)
        items = res.scalars().all()

    return {
        "announcements": [
            {
                "id": str(a.id),
                "author_id": str(a.author_id),
                "author_name": a.author_name,
                "title": a.title,
                "content": a.content,
                "department": a.department,
                "priority": a.priority,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ]
    }


@router.post("")
async def create_announcement(
    body: CreateAnnouncementRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    author_name = user.full_name or user.email.split("@")[0].capitalize()
    ann = Announcement(
        author_id=user.id,
        author_name=author_name,
        title=body.title,
        content=body.content,
        department=body.department,
        priority=body.priority,
    )
    db.add(ann)
    await db.commit()

    return {
        "status": "ok",
        "announcement": {
            "id": str(ann.id),
            "title": ann.title,
            "department": ann.department,
            "priority": ann.priority,
            "created_at": ann.created_at.isoformat(),
        },
    }

