"""
Enterprise Tasks API routes for Titan.
Handles personal tasks, assigned tasks, team tasks, Kanban board stages,
priorities, due dates, and cross-application task creation.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Notification, TaskItem, User
from app.db.session import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # low, medium, high, urgent
    status: str = "todo"  # todo, in_progress, in_review, completed
    department: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    due_date: Optional[str] = None
    source_ref: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    due_date: Optional[str] = None


@router.get("")
async def list_tasks(
    user: CurrentUser,
    status_filter: Optional[str] = Query(None),
    view: str = Query("all"),  # all, me, team
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TaskItem)

    if view == "me":
        stmt = stmt.where(or_(TaskItem.assignee_id == user.id, TaskItem.creator_id == user.id))
    elif view == "team" and user.department:
        stmt = stmt.where(TaskItem.department == user.department)

    if status_filter:
        stmt = stmt.where(TaskItem.status == status_filter)

    if department:
        stmt = stmt.where(TaskItem.department == department)

    stmt = stmt.order_by(TaskItem.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    # Seed initial sample tasks if empty
    if len(tasks) == 0 and view == "all" and not status_filter:
        samples = [
            ("Review Q3 compliance audit report", "Verify regulatory compliance across all finance and operations records.", "urgent", "todo", "Finance"),
            ("Set up on-premises Ollama 3B model cluster", "Configure local inference nodes and verify latency under 50ms.", "high", "in_progress", "Engineering"),
            ("Update employee handbook for hybrid workplace", "Incorporate new travel policy, health insurance benefits, and PTO guidelines.", "medium", "in_review", "HR"),
            ("Finalize air-gapped system security sign-off", "Deliver final vulnerability assessment and penetration test report to CISO.", "high", "completed", "Security"),
        ]
        for t_title, t_desc, t_prio, t_stat, t_dept in samples:
            sample_t = TaskItem(
                title=t_title,
                description=t_desc,
                creator_id=user.id,
                assignee_id=user.id,
                assignee_name=user.full_name or "Titan Employee",
                department=t_dept,
                priority=t_prio,
                status=t_stat,
            )
            db.add(sample_t)
        await db.commit()
        # Re-query
        result = await db.execute(stmt)
        tasks = result.scalars().all()

    return {
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "creator_id": str(t.creator_id),
                "assignee_id": str(t.assignee_id) if t.assignee_id else None,
                "assignee_name": t.assignee_name,
                "department": t.department,
                "priority": t.priority,
                "status": t.status,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "source_ref": t.source_ref,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "is_mine": (t.assignee_id == user.id or t.creator_id == user.id),
            }
            for t in tasks
        ]
    }


@router.post("")
async def create_task(
    body: CreateTaskRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    assignee_uuid = None
    if body.assignee_id:
        try:
            assignee_uuid = uuid.UUID(body.assignee_id)
        except ValueError:
            pass

    due_dt = None
    if body.due_date:
        try:
            due_dt = datetime.fromisoformat(body.due_date)
        except ValueError:
            pass

    assignee_name = body.assignee_name
    if not assignee_name and assignee_uuid:
        u_stmt = select(User).where(User.id == assignee_uuid)
        u_res = await db.execute(u_stmt)
        u_obj = u_res.scalar_one_or_none()
        if u_obj:
            assignee_name = u_obj.full_name or u_obj.email

    task = TaskItem(
        title=body.title,
        description=body.description,
        creator_id=user.id,
        assignee_id=assignee_uuid or user.id,
        assignee_name=assignee_name or user.full_name,
        department=body.department or user.department,
        priority=body.priority,
        status=body.status,
        due_date=due_dt,
        source_ref=body.source_ref,
    )
    db.add(task)

    # Notify assignee if assigned to someone else
    if assignee_uuid and assignee_uuid != user.id:
        notif = Notification(
            user_id=assignee_uuid,
            title="New Task Assigned",
            message=f"{user.full_name or user.email} assigned you: '{body.title}'",
            type="task",
            link="/app/tasks",
        )
        db.add(notif)

    await db.commit()

    return {
        "status": "ok",
        "task": {
            "id": str(task.id),
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "department": task.department,
        },
    }


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    body: UpdateTaskRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    stmt = select(TaskItem).where(TaskItem.id == tid)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.priority is not None:
        task.priority = body.priority
    if body.status is not None:
        task.status = body.status
    if body.department is not None:
        task.department = body.department
    if body.assignee_id is not None:
        try:
            task.assignee_id = uuid.UUID(body.assignee_id) if body.assignee_id else None
        except ValueError:
            pass
    if body.assignee_name is not None:
        task.assignee_name = body.assignee_name
    if body.due_date is not None:
        try:
            task.due_date = datetime.fromisoformat(body.due_date) if body.due_date else None
        except ValueError:
            pass

    await db.commit()
    return {"status": "ok", "task": {"id": str(task.id), "status": task.status}}


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    stmt = select(TaskItem).where(TaskItem.id == tid)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    return {"status": "ok"}

