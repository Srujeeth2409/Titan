"""
Enterprise Quick Notes API routes for Titan.
Handles sticky notes, scratchpads, pinned items, and color themes.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import QuickNote
from app.db.session import get_db

router = APIRouter(prefix="/notes", tags=["notes"])


class CreateNoteRequest(BaseModel):
    title: str = "Untitled Note"
    content: str = ""
    color: str = "blue"
    is_pinned: bool = False


class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None


@router.get("")
async def list_notes(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(QuickNote)
        .where(QuickNote.user_id == user.id)
        .order_by(QuickNote.is_pinned.desc(), QuickNote.updated_at.desc())
    )
    res = await db.execute(stmt)
    notes = res.scalars().all()

    # Seed default welcome note if none exist
    if len(notes) == 0:
        default_note = QuickNote(
            user_id=user.id,
            title="Welcome to Quick Notes",
            content="Use this scratchpad to jot down quick meeting takeaways, project links, or temporary reminders.\n\n• Hit '+' to create a new note\n• Pin important notes to keep them on top\n• Color code by project or priority",
            color="amber",
            is_pinned=True,
        )
        db.add(default_note)
        await db.commit()
        notes = [default_note]

    return {
        "notes": [
            {
                "id": str(n.id),
                "title": n.title,
                "content": n.content,
                "color": n.color,
                "is_pinned": n.is_pinned,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            }
            for n in notes
        ]
    }


@router.post("")
async def create_note(
    body: CreateNoteRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    note = QuickNote(
        user_id=user.id,
        title=body.title or "Untitled Note",
        content=body.content,
        color=body.color,
        is_pinned=body.is_pinned,
    )
    db.add(note)
    await db.commit()

    return {
        "status": "ok",
        "note": {
            "id": str(note.id),
            "title": note.title,
            "content": note.content,
            "color": note.color,
            "is_pinned": note.is_pinned,
            "created_at": note.created_at.isoformat(),
        },
    }


@router.patch("/{note_id}")
async def update_note(
    note_id: str,
    body: UpdateNoteRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        nid = uuid.UUID(note_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid note ID")

    stmt = select(QuickNote).where(QuickNote.id == nid, QuickNote.user_id == user.id)
    res = await db.execute(stmt)
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if body.title is not None:
        note.title = body.title
    if body.content is not None:
        note.content = body.content
    if body.color is not None:
        note.color = body.color
    if body.is_pinned is not None:
        note.is_pinned = body.is_pinned

    note.updated_at = datetime.utcnow()
    await db.commit()

    return {"status": "ok", "note": {"id": str(note.id), "title": note.title}}


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        nid = uuid.UUID(note_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid note ID")

    stmt = select(QuickNote).where(QuickNote.id == nid, QuickNote.user_id == user.id)
    res = await db.execute(stmt)
    note = res.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)
    await db.commit()
    return {"status": "ok"}

