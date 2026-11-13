"""
Enterprise Workspace Chat API routes for Titan.
Handles Channels, DMs, Department Groups, Messages, Reactions, File Sharing, Status.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import ChatChannel, ChatMember, ChatMessage, Notification, User
from app.db.session import get_db

router = APIRouter(prefix="/chat", tags=["chat"])


class CreateChannelRequest(BaseModel):
    name: str
    channel_type: str = "group"  # direct, group, department
    department: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[List[str]] = []


class SendMessageRequest(BaseModel):
    message_text: str
    attachments: Optional[List[dict]] = []
    reply_to_id: Optional[str] = None


class ReactionRequest(BaseModel):
    emoji: str


async def _ensure_default_channels(db: AsyncSession, user_id: uuid.UUID):
    """Seed initial company department channels if none exist."""
    res = await db.execute(select(func.count(ChatChannel.id)))
    count = res.scalar() or 0
    if count == 0:
        defaults = [
            ("general", "Company-wide general discussion & announcements", "department", "All"),
            ("engineering", "Tech, architecture, bug triage & releases", "department", "Engineering"),
            ("hr-team", "HR updates, workplace questions & culture", "department", "HR"),
            ("finance-ops", "Financial reviews, budgets and operations", "department", "Finance"),
            ("analytics", "Data insights, dashboards and experimentation", "department", "Analytics"),
        ]
        for name, descr, c_type, dept in defaults:
            ch = ChatChannel(
                name=name,
                description=descr,
                channel_type=c_type,
                department=dept,
                created_by=user_id,
            )
            db.add(ch)
            await db.flush()
            # Add user as member
            db.add(ChatMember(channel_id=ch.id, user_id=user_id))
        await db.commit()


@router.get("/channels")
async def list_channels(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _ensure_default_channels(db, user.id)

    # Get channels where user is member or channels that are public/department
    stmt = (
        select(ChatChannel)
        .outerjoin(ChatMember, (ChatMember.channel_id == ChatChannel.id) & (ChatMember.user_id == user.id))
        .where(
            or_(
                ChatMember.user_id == user.id,
                ChatChannel.channel_type == "department",
            )
        )
        .distinct()
        .order_by(ChatChannel.name.asc())
    )
    result = await db.execute(stmt)
    channels = result.scalars().all()

    # Get last message for each channel
    payload = []
    for ch in channels:
        last_msg_stmt = (
            select(ChatMessage)
            .where(ChatMessage.channel_id == ch.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        last_msg_res = await db.execute(last_msg_stmt)
        last_msg = last_msg_res.scalar_one_or_none()

        payload.append({
            "id": str(ch.id),
            "name": ch.name,
            "channel_type": ch.channel_type,
            "department": ch.department,
            "description": ch.description,
            "last_message": {
                "text": last_msg.message_text,
                "sender_name": last_msg.sender_name,
                "created_at": last_msg.created_at.isoformat(),
            } if last_msg else None,
        })

    return {"channels": payload}


@router.post("/channels")
async def create_channel(
    body: CreateChannelRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    channel = ChatChannel(
        name=body.name.strip().lower().replace(" ", "-"),
        channel_type=body.channel_type,
        department=body.department,
        description=body.description,
        created_by=user.id,
    )
    db.add(channel)
    await db.flush()

    # Add creator as member
    db.add(ChatMember(channel_id=channel.id, user_id=user.id))

    # Add any specified members
    for mid_str in (body.member_ids or []):
        try:
            mid = uuid.UUID(mid_str)
            if mid != user.id:
                db.add(ChatMember(channel_id=channel.id, user_id=mid))
        except ValueError:
            pass

    await db.commit()
    return {
        "status": "ok",
        "channel": {
            "id": str(channel.id),
            "name": channel.name,
            "channel_type": channel.channel_type,
            "department": channel.department,
            "description": channel.description,
        },
    }


@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    user: CurrentUser,
    limit: int = Query(50, le=100),
    before: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        cid = uuid.UUID(channel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid channel ID")

    stmt = select(ChatMessage).where(ChatMessage.channel_id == cid)
    if before:
        try:
            b_dt = datetime.fromisoformat(before)
            stmt = stmt.where(ChatMessage.created_at < b_dt)
        except ValueError:
            pass

    stmt = stmt.order_by(ChatMessage.created_at.asc()).limit(limit)
    result = await db.execute(stmt)
    messages = result.scalars().all()

    return {
        "messages": [
            {
                "id": str(m.id),
                "channel_id": str(m.channel_id),
                "user_id": str(m.user_id),
                "sender_name": m.sender_name,
                "message_text": m.message_text,
                "attachments": m.attachments or [],
                "reactions": m.reactions or {},
                "reply_to_id": str(m.reply_to_id) if m.reply_to_id else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "is_me": (m.user_id == user.id),
            }
            for m in messages
        ]
    }


@router.post("/channels/{channel_id}/messages")
async def send_message(
    channel_id: str,
    body: SendMessageRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        cid = uuid.UUID(channel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid channel ID")

    sender_name = getattr(user, "full_name", None) or user.email.split("@")[0].capitalize()

    reply_to_uuid = None
    if body.reply_to_id:
        try:
            reply_to_uuid = uuid.UUID(body.reply_to_id)
        except ValueError:
            pass

    msg = ChatMessage(
        channel_id=cid,
        user_id=user.id,
        sender_name=sender_name,
        message_text=body.message_text,
        attachments=body.attachments or [],
        reactions={},
        reply_to_id=reply_to_uuid,
    )
    db.add(msg)
    await db.commit()

    return {
        "status": "ok",
        "message": {
            "id": str(msg.id),
            "channel_id": str(msg.channel_id),
            "user_id": str(msg.user_id),
            "sender_name": msg.sender_name,
            "message_text": msg.message_text,
            "attachments": msg.attachments or [],
            "reactions": msg.reactions or {},
            "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "is_me": True,
        },
    }


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: str,
    body: ReactionRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        mid = uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message ID")

    stmt = select(ChatMessage).where(ChatMessage.id == mid)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = dict(msg.reactions or {})
    emoji = body.emoji
    user_str = str(user.id)

    users_list = reactions.get(emoji, [])
    if user_str in users_list:
        users_list.remove(user_str)
        if not users_list:
            reactions.pop(emoji, None)
        else:
            reactions[emoji] = users_list
    else:
        users_list.append(user_str)
        reactions[emoji] = users_list

    msg.reactions = reactions
    await db.commit()

    return {"status": "ok", "reactions": msg.reactions}

