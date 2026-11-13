"""
Enterprise Calendar API routes for Titan.
Handles Personal/Shared Calendars, Day/Week/Month events, Recurring Events,
Meeting Invitations, Availability and Conflict Detection.
"""
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import String, and_, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import CalendarEvent, Notification, User
from app.db.session import get_db

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _parse_iso_datetime(val: str) -> datetime:
    """Parse ISO string and return naive datetime for PostgreSQL timestamp."""
    cleaned = val.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


class EventCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: str  # ISO string
    end_time: str  # ISO string
    is_all_day: bool = False
    location: Optional[str] = None
    recurrence: str = "none"  # none, daily, weekly, monthly
    department: Optional[str] = None
    attendees: Optional[List[str]] = []
    meeting_link: Optional[str] = None


class EventUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: Optional[bool] = None
    location: Optional[str] = None
    recurrence: Optional[str] = None
    department: Optional[str] = None
    attendees: Optional[List[str]] = None
    meeting_link: Optional[str] = None


class ConflictCheckRequest(BaseModel):
    start_time: str
    end_time: str
    attendees: Optional[List[str]] = []
    exclude_event_id: Optional[str] = None


@router.get("/events")
async def get_events(
    user: CurrentUser,
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CalendarEvent).where(
        or_(
            CalendarEvent.user_id == user.id,
            cast(CalendarEvent.attendees, String).ilike(f"%{user.email}%"),
            CalendarEvent.department == user.department,
            CalendarEvent.department == "All",
        )
    )

    if start:
        try:
            st = _parse_iso_datetime(start)
            stmt = stmt.where(CalendarEvent.end_time >= st)
        except ValueError:
            pass

    if end:
        try:
            et = _parse_iso_datetime(end)
            stmt = stmt.where(CalendarEvent.start_time <= et)
        except ValueError:
            pass

    if department:
        stmt = stmt.where(CalendarEvent.department == department)

    stmt = stmt.order_by(CalendarEvent.start_time.asc())
    result = await db.execute(stmt)
    events = result.scalars().all()

    return {
        "events": [
            {
                "id": str(e.id),
                "user_id": str(e.user_id),
                "title": e.title,
                "description": e.description,
                "start_time": e.start_time.isoformat(),
                "end_time": e.end_time.isoformat(),
                "is_all_day": e.is_all_day,
                "location": e.location,
                "recurrence": e.recurrence,
                "department": e.department,
                "attendees": e.attendees or [],
                "meeting_link": e.meeting_link,
                "is_owner": (e.user_id == user.id),
            }
            for e in events
        ]
    }


@router.post("/events")
async def create_event(
    body: EventCreateRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        st = _parse_iso_datetime(body.start_time)
        et = _parse_iso_datetime(body.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start or end time format")

    if et < st:
        raise HTTPException(status_code=400, detail="End time cannot be earlier than start time")

    event = CalendarEvent(
        user_id=user.id,
        title=body.title,
        description=body.description,
        start_time=st,
        end_time=et,
        is_all_day=body.is_all_day,
        location=body.location,
        recurrence=body.recurrence,
        department=body.department or user.department,
        attendees=body.attendees or [],
        meeting_link=body.meeting_link,
    )
    db.add(event)

    # Notify attendees
    for attendee_email in (body.attendees or []):
        u_stmt = select(User).where(User.email == attendee_email)
        u_res = await db.execute(u_stmt)
        att_user = u_res.scalar_one_or_none()
        if att_user and att_user.id != user.id:
            notif = Notification(
                user_id=att_user.id,
                title=f"Calendar Invitation: {body.title}",
                message=f"Scheduled for {st.strftime('%b %d, %Y at %H:%M')}",
                type="calendar",
                link="/app/calendar",
            )
            db.add(notif)

    await db.commit()

    return {
        "status": "ok",
        "event": {
            "id": str(event.id),
            "title": event.title,
            "start_time": event.start_time.isoformat(),
            "end_time": event.end_time.isoformat(),
            "is_all_day": event.is_all_day,
            "location": event.location,
            "meeting_link": event.meeting_link,
            "attendees": event.attendees or [],
        },
    }


@router.post("/check-conflicts")
async def check_conflicts(
    body: ConflictCheckRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        st = _parse_iso_datetime(body.start_time)
        et = _parse_iso_datetime(body.end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    stmt = select(CalendarEvent).where(
        CalendarEvent.start_time < et,
        CalendarEvent.end_time > st,
    )

    if body.exclude_event_id:
        try:
            ex_id = uuid.UUID(body.exclude_event_id)
            stmt = stmt.where(CalendarEvent.id != ex_id)
        except ValueError:
            pass

    # Filter to current user and requested attendees
    target_emails = set([user.email] + (body.attendees or []))
    res = await db.execute(stmt)
    all_overlap = res.scalars().all()

    conflicts = []
    for ev in all_overlap:
        overlap_attendees = [a for a in (ev.attendees or []) if a in target_emails]
        if ev.user_id == user.id or overlap_attendees:
            conflicts.append({
                "event_id": str(ev.id),
                "title": ev.title,
                "start_time": ev.start_time.isoformat(),
                "end_time": ev.end_time.isoformat(),
                "conflicting_attendees": overlap_attendees or [user.email],
            })

    return {
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts,
    }


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    body: EventUpdateRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    stmt = select(CalendarEvent).where(CalendarEvent.id == eid)
    res = await db.execute(stmt)
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    if body.title is not None:
        ev.title = body.title
    if body.description is not None:
        ev.description = body.description
    if body.start_time is not None:
        ev.start_time = _parse_iso_datetime(body.start_time)
    if body.end_time is not None:
        ev.end_time = _parse_iso_datetime(body.end_time)
    if body.is_all_day is not None:
        ev.is_all_day = body.is_all_day
    if body.location is not None:
        ev.location = body.location
    if body.recurrence is not None:
        ev.recurrence = body.recurrence
    if body.department is not None:
        ev.department = body.department
    if body.attendees is not None:
        ev.attendees = body.attendees
    if body.meeting_link is not None:
        ev.meeting_link = body.meeting_link

    await db.commit()
    return {"status": "ok", "id": str(ev.id)}


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    stmt = select(CalendarEvent).where(CalendarEvent.id == eid)
    res = await db.execute(stmt)
    ev = res.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(ev)
    await db.commit()
    return {"status": "ok"}

