"""
Enterprise Global Search API routes for Titan.
Provides instant unified Cmd+K search across files, emails, chat messages,
tasks, directory employees, and authorized company documents.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import (
    ChatMessage,
    Document,
    Email,
    TaskItem,
    User,
    WorkspaceFile,
)
from app.db.session import get_db

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/global")
async def global_search(
    user: CurrentUser,
    q: str = Query(..., min_length=1),
    limit_per_category: int = Query(5, le=10),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q.strip()}%"
    results = {
        "files": [],
        "emails": [],
        "tasks": [],
        "messages": [],
        "employees": [],
        "documents": [],
    }

    # 1. Search Files
    f_stmt = (
        select(WorkspaceFile)
        .where(
            or_(
                WorkspaceFile.name.ilike(pattern),
                WorkspaceFile.summary.ilike(pattern),
            )
        )
        .limit(limit_per_category)
    )
    f_res = await db.execute(f_stmt)
    for f in f_res.scalars().all():
        results["files"].append({
            "id": str(f.id),
            "title": f.name,
            "subtitle": f"{f.folder_path} • {round(f.size_bytes / 1024, 1)} KB",
            "type": "file",
            "link": f"/app/files?path={f.folder_path}",
        })

    # 2. Search Emails (user's emails)
    e_stmt = (
        select(Email)
        .where(
            Email.user_id == user.id,
            or_(
                Email.subject.ilike(pattern),
                Email.body_text.ilike(pattern),
                Email.sender_name.ilike(pattern),
            ),
        )
        .order_by(Email.created_at.desc())
        .limit(limit_per_category)
    )
    e_res = await db.execute(e_stmt)
    for e in e_res.scalars().all():
        results["emails"].append({
            "id": str(e.id),
            "title": e.subject,
            "subtitle": f"From: {e.sender_name} • {e.folder.capitalize()}",
            "type": "mail",
            "link": f"/app/mail?id={e.id}",
        })

    # 3. Search Tasks
    t_stmt = (
        select(TaskItem)
        .where(
            or_(
                TaskItem.title.ilike(pattern),
                TaskItem.description.ilike(pattern),
            )
        )
        .order_by(TaskItem.created_at.desc())
        .limit(limit_per_category)
    )
    t_res = await db.execute(t_stmt)
    for t in t_res.scalars().all():
        results["tasks"].append({
            "id": str(t.id),
            "title": t.title,
            "subtitle": f"Status: {t.status} • Priority: {t.priority} • {t.department}",
            "type": "task",
            "link": f"/app/tasks",
        })

    # 4. Search Chat Messages
    m_stmt = (
        select(ChatMessage)
        .where(ChatMessage.message_text.ilike(pattern))
        .order_by(ChatMessage.created_at.desc())
        .limit(limit_per_category)
    )
    m_res = await db.execute(m_stmt)
    for m in m_res.scalars().all():
        results["messages"].append({
            "id": str(m.id),
            "title": m.message_text[:80],
            "subtitle": f"From {m.sender_name}",
            "type": "chat",
            "link": f"/app/chat?channel_id={m.channel_id}",
        })

    # 5. Search Employees / Directory
    u_stmt = (
        select(User)
        .where(
            User.is_active == True,
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.title.ilike(pattern),
                User.department.ilike(pattern),
            ),
        )
        .limit(limit_per_category)
    )
    u_res = await db.execute(u_stmt)
    for u in u_res.scalars().all():
        results["employees"].append({
            "id": str(u.id),
            "title": u.full_name or u.email,
            "subtitle": f"{u.title or 'Staff'} • {u.department} ({u.status})",
            "type": "employee",
            "link": f"/app/directory?q={u.email}",
        })

    # 6. Search RAG Documents
    d_stmt = (
        select(Document)
        .where(Document.filename.ilike(pattern))
        .limit(limit_per_category)
    )
    d_res = await db.execute(d_stmt)
    for d in d_res.scalars().all():
        results["documents"].append({
            "id": str(d.id),
            "title": d.filename,
            "subtitle": f"RAG System Document • {d.chunk_count or 0} chunks",
            "type": "document",
            "link": f"/app",
        })

    total_hits = sum(len(v) for v in results.values())
    return {
        "query": q,
        "total_hits": total_hits,
        "results": results,
    }

