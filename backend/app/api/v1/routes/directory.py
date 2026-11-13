"""
Enterprise Directory API routes for Titan.
Handles employee roster, departments, roles, availability, and profile updates.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/directory", tags=["directory"])


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None  # online, busy, away, offline
    status_message: Optional[str] = None


@router.get("")
async def list_employees(
    user: CurrentUser,
    department: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.is_active == True)

    if department and department != "All":
        stmt = stmt.where(User.department == department)

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
                User.title.ilike(search_pattern),
                User.department.ilike(search_pattern),
            )
        )

    stmt = stmt.order_by(User.full_name.asc(), User.email.asc())
    res = await db.execute(stmt)
    users = res.scalars().all()

    return {
        "employees": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name or u.email.split("@")[0].capitalize(),
                "department": u.department or "General",
                "role": u.role or "Employee",
                "title": u.title or "Titan Staff",
                "phone": u.phone or "+1 (555) 019-2834",
                "status": u.status or "online",
                "status_message": u.status_message,
                "avatar_url": u.avatar_url,
                "is_me": (u.id == user.id),
            }
            for u in users
        ]
    }


@router.get("/departments")
async def list_departments(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User.department, func.count(User.id)).where(User.is_active == True).group_by(User.department)
    res = await db.execute(stmt)
    rows = res.fetchall()

    departments = [{"name": "All", "count": sum(r[1] for r in rows)}]
    for dept, count in rows:
        if dept:
            departments.append({"name": dept, "count": count})

    # Ensure baseline departments are represented
    existing_names = set(d["name"] for d in departments)
    for std_dept in ["HR", "Finance", "Analytics", "Operations", "Management", "Engineering"]:
        if std_dept not in existing_names:
            departments.append({"name": std_dept, "count": 1})

    return {"departments": departments}


@router.get("/me")
async def get_my_profile(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name or user.email.split("@")[0].capitalize(),
        "department": user.department or "General",
        "role": user.role or "Employee",
        "title": user.title or "Staff Member",
        "phone": user.phone or "+1 (555) 019-2834",
        "status": user.status or "online",
        "status_message": user.status_message,
        "avatar_url": user.avatar_url,
    }


@router.patch("/me")
async def update_my_profile(
    body: UpdateProfileRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    # Fetch fresh instance
    res = await db.execute(select(User).where(User.id == user.id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name is not None:
        u.full_name = body.full_name
    if body.title is not None:
        u.title = body.title
    if body.department is not None:
        u.department = body.department
    if body.phone is not None:
        u.phone = body.phone
    if body.status is not None:
        u.status = body.status
    if body.status_message is not None:
        u.status_message = body.status_message

    await db.commit()
    return {"status": "ok"}

