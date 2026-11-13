"""
Enterprise Meetings API routes for Titan.
Handles scheduling, room code generation, meeting state, notes,
action items tracking, and cross-app Task conversion.
"""
import secrets
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Meeting, Notification, TaskItem, User
from app.db.session import get_db

router = APIRouter(prefix="/meetings", tags=["meetings"])


class CreateMeetingRequest(BaseModel):
    title: str
    department: Optional[str] = None
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None


class UpdateMeetingRequest(BaseModel):
    notes: Optional[str] = None
    action_items: Optional[List[dict]] = None
    is_active: Optional[bool] = None


class ConvertActionsRequest(BaseModel):
    items: List[dict]  # [{ title: str, assignee_name?: str, priority?: str, due_date?: str }]


def _generate_room_code() -> str:
    part1 = secrets.token_hex(2)
    part2 = secrets.token_hex(2)
    part3 = secrets.token_hex(2)
    return f"{part1}-{part2}-{part3}"


@router.get("")
async def list_meetings(
    user: CurrentUser,
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Meeting)
        .order_by(Meeting.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    meetings = result.scalars().all()

    return {
        "meetings": [
            {
                "id": str(m.id),
                "room_code": m.room_code,
                "title": m.title,
                "host_id": str(m.host_id),
                "host_name": m.host_name,
                "department": m.department,
                "is_active": m.is_active,
                "scheduled_start": m.scheduled_start.isoformat() if m.scheduled_start else None,
                "scheduled_end": m.scheduled_end.isoformat() if m.scheduled_end else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "action_items_count": len(m.action_items or []),
            }
            for m in meetings
        ]
    }


@router.post("")
async def create_meeting(
    body: CreateMeetingRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    room_code = _generate_room_code()
    host_name = getattr(user, "full_name", None) or user.email.split("@")[0].capitalize()

    st = datetime.fromisoformat(body.scheduled_start) if body.scheduled_start else None
    et = datetime.fromisoformat(body.scheduled_end) if body.scheduled_end else None

    meeting = Meeting(
        room_code=room_code,
        title=body.title,
        host_id=user.id,
        host_name=host_name,
        department=body.department or user.department,
        is_active=True,
        notes="",
        action_items=[],
        participant_history=[{"name": host_name, "email": user.email, "joined_at": datetime.utcnow().isoformat()}],
        scheduled_start=st,
        scheduled_end=et,
    )
    db.add(meeting)
    await db.commit()

    return {
        "status": "ok",
        "meeting": {
            "room_code": meeting.room_code,
            "title": meeting.title,
            "host_name": meeting.host_name,
            "is_active": meeting.is_active,
        },
    }


@router.get("/{room_code}")
async def get_meeting(
    room_code: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Meeting).where(Meeting.room_code == room_code)
    result = await db.execute(stmt)
    m = result.scalar_one_or_none()
    if not m:
        # Create an ad-hoc room if not existing so anyone can join instant link
        host_name = getattr(user, "full_name", None) or user.email.split("@")[0].capitalize()
        m = Meeting(
            room_code=room_code,
            title=f"Conference ({room_code})",
            host_id=user.id,
            host_name=host_name,
            department=user.department,
            is_active=True,
            notes="",
            action_items=[],
            participant_history=[{"name": host_name, "email": user.email, "joined_at": datetime.utcnow().isoformat()}],
        )
        db.add(m)
        await db.commit()

    return {
        "id": str(m.id),
        "room_code": m.room_code,
        "title": m.title,
        "host_id": str(m.host_id),
        "host_name": m.host_name,
        "department": m.department,
        "is_active": m.is_active,
        "notes": m.notes,
        "action_items": m.action_items or [],
        "participant_history": m.participant_history or [],
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.patch("/{room_code}")
async def update_meeting(
    room_code: str,
    body: UpdateMeetingRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Meeting).where(Meeting.room_code == room_code)
    result = await db.execute(stmt)
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if body.notes is not None:
        m.notes = body.notes
    if body.action_items is not None:
        m.action_items = body.action_items
    if body.is_active is not None:
        m.is_active = body.is_active

    await db.commit()
    return {"status": "ok", "room_code": m.room_code}


@router.post("/{room_code}/convert-actions")
async def convert_actions_to_tasks(
    room_code: str,
    body: ConvertActionsRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-app integration: Converts meeting action items into real Tasks in Titan Tasks.
    """
    stmt = select(Meeting).where(Meeting.room_code == room_code)
    result = await db.execute(stmt)
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    created_tasks = []
    for item in body.items:
        title = item.get("title", "").strip()
        if not title:
            continue

        priority = item.get("priority", "medium")
        assignee_name = item.get("assignee_name")

        # Find assignee user if matching
        assignee_id = None
        if assignee_name:
            u_stmt = select(User).where(
                (User.full_name.ilike(f"%{assignee_name}%")) | (User.email.ilike(f"%{assignee_name}%"))
            )
            u_res = await db.execute(u_stmt)
            matched_user = u_res.scalar_one_or_none()
            if matched_user:
                assignee_id = matched_user.id
                assignee_name = matched_user.full_name

        task = TaskItem(
            title=title,
            description=f"Action item generated from meeting: {m.title} (Room: {m.room_code})",
            creator_id=user.id,
            assignee_id=assignee_id or user.id,
            assignee_name=assignee_name or user.full_name,
            department=m.department or user.department,
            priority=priority,
            status="todo",
            source_ref=f"meeting:{m.room_code}",
        )
        db.add(task)
        created_tasks.append(title)

    await db.commit()
    return {"status": "ok", "converted_count": len(created_tasks), "tasks": created_tasks}


class MeetingSignalPayload(BaseModel):
    peer_id: str
    sender_name: str
    signal_type: str  # "join", "offer", "answer", "candidate", "leave", "chat"
    target_peer_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# In-memory transient signal bus for WebRTC room exchanges (with TTL cleanup)
_ROOM_SIGNALS: Dict[str, List[Dict[str, Any]]] = {}
_ROOM_PEERS: Dict[str, Dict[str, Dict[str, Any]]] = {}


@router.post("/{room_code}/signal")
async def send_meeting_signal(
    room_code: str,
    payload: MeetingSignalPayload,
    user: CurrentUser,
):
    """
    Exchanges WebRTC signaling messages (Offer, Answer, ICE Candidates, Presence, Chat).
    Supports peer-to-peer video streaming across any two computers.
    """
    now = time.time()
    room_signals = _ROOM_SIGNALS.setdefault(room_code, [])
    # Prune signals older than 45 seconds
    _ROOM_SIGNALS[room_code] = [s for s in room_signals if now - s["timestamp"] < 45]

    sender = payload.sender_name or getattr(user, "full_name", None) or getattr(user, "email", "Colleague")

    signal_entry = {
        "id": str(uuid.uuid4()),
        "peer_id": payload.peer_id,
        "sender_name": sender,
        "signal_type": payload.signal_type,
        "target_peer_id": payload.target_peer_id,
        "data": payload.data or {},
        "timestamp": now,
    }
    _ROOM_SIGNALS[room_code].append(signal_entry)

    # Track active peers
    room_peers = _ROOM_PEERS.setdefault(room_code, {})
    if payload.signal_type == "leave":
        room_peers.pop(payload.peer_id, None)
    else:
        room_peers[payload.peer_id] = {
            "peer_id": payload.peer_id,
            "sender_name": sender,
            "last_seen": now,
        }

    return {"status": "ok"}


@router.get("/{room_code}/signals")
async def poll_meeting_signals(
    room_code: str,
    peer_id: str,
    since: float = Query(0.0),
    user: CurrentUser = None,
):
    """
    Polls pending WebRTC signals and active participants for the meeting room.
    """
    now = time.time()
    room_signals = _ROOM_SIGNALS.get(room_code, [])

    # Update heartbeat for polling peer
    room_peers = _ROOM_PEERS.setdefault(room_code, {})
    sender = getattr(user, "full_name", None) or getattr(user, "email", "Colleague")
    room_peers[peer_id] = {
        "peer_id": peer_id,
        "sender_name": sender,
        "last_seen": now,
    }

    # Prune inactive peers (> 12 seconds without ping)
    active_peers = [
        p for pid, p in list(room_peers.items())
        if now - p["last_seen"] < 12 and pid != peer_id
    ]

    # Return signals intended for everyone or specifically for peer_id
    pending = [
        s for s in room_signals
        if s["timestamp"] > since
        and s["peer_id"] != peer_id
        and (s["target_peer_id"] is None or s["target_peer_id"] == peer_id)
    ]

    return {
        "signals": pending,
        "active_peers": active_peers,
        "timestamp": now,
    }

