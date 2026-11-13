"""
Enterprise Mail API routes for Titan.
Handles Inbox, Sent, Drafts, Archive, Trash, Starred, Compose, Reply, Forward, Attachments.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Email, Notification, User
from app.db.session import get_db

router = APIRouter(prefix="/mail", tags=["mail"])


class ComposeEmailRequest(BaseModel):
    recipient_emails: List[str]
    cc_emails: Optional[List[str]] = []
    bcc_emails: Optional[List[str]] = []
    subject: str = "(No Subject)"
    body_text: str = ""
    body_html: Optional[str] = ""
    attachments: Optional[List[dict]] = []
    is_draft: bool = False
    draft_id: Optional[str] = None


class UpdateMailRequest(BaseModel):
    folder: Optional[str] = None  # inbox, sent, drafts, archive, trash
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None


@router.get("")
async def get_emails(
    user: CurrentUser,
    folder: str = Query("inbox"),
    q: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Email).where(Email.user_id == user.id)
    if folder == "starred":
        stmt = stmt.where(Email.is_starred == True)
    else:
        stmt = stmt.where(Email.folder == folder)

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Email.subject.ilike(search_term),
                Email.sender_name.ilike(search_term),
                Email.sender_email.ilike(search_term),
                Email.body_text.ilike(search_term),
            )
        )

    stmt = stmt.order_by(Email.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    emails = result.scalars().all()

    return {
        "items": [
            {
                "id": str(e.id),
                "sender_email": e.sender_email,
                "sender_name": e.sender_name,
                "recipient_emails": e.recipient_emails or [],
                "cc_emails": e.cc_emails or [],
                "bcc_emails": e.bcc_emails or [],
                "subject": e.subject,
                "body_text": e.body_text,
                "body_html": e.body_html,
                "folder": e.folder,
                "is_read": e.is_read,
                "is_starred": e.is_starred,
                "attachments": e.attachments or [],
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in emails
        ],
        "total": len(emails),
    }


@router.get("/counts")
async def get_mail_counts(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    counts = {"inbox": 0, "sent": 0, "drafts": 0, "archive": 0, "trash": 0, "starred": 0, "unread_inbox": 0}
    for f in ["inbox", "sent", "drafts", "archive", "trash"]:
        stmt = select(func.count(Email.id)).where(Email.user_id == user.id, Email.folder == f)
        res = await db.execute(stmt)
        counts[f] = res.scalar() or 0

    star_stmt = select(func.count(Email.id)).where(Email.user_id == user.id, Email.is_starred == True)
    counts["starred"] = (await db.execute(star_stmt)).scalar() or 0

    unread_stmt = select(func.count(Email.id)).where(
        Email.user_id == user.id, Email.folder == "inbox", Email.is_read == False
    )
    counts["unread_inbox"] = (await db.execute(unread_stmt)).scalar() or 0

    return counts


@router.get("/{mail_id}")
async def get_email(
    mail_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = uuid.UUID(mail_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid mail ID")

    stmt = select(Email).where(Email.id == uid, Email.user_id == user.id)
    result = await db.execute(stmt)
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if not email.is_read:
        email.is_read = True
        await db.commit()

    return {
        "id": str(email.id),
        "sender_email": email.sender_email,
        "sender_name": email.sender_name,
        "recipient_emails": email.recipient_emails or [],
        "cc_emails": email.cc_emails or [],
        "bcc_emails": email.bcc_emails or [],
        "subject": email.subject,
        "body_text": email.body_text,
        "body_html": email.body_html,
        "folder": email.folder,
        "is_read": email.is_read,
        "is_starred": email.is_starred,
        "attachments": email.attachments or [],
        "created_at": email.created_at.isoformat() if email.created_at else None,
    }


@router.post("/send")
async def send_email(
    body: ComposeEmailRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    sender_name = getattr(user, "full_name", None) or user.email.split("@")[0].capitalize()

    # If updating an existing draft
    if body.draft_id:
        try:
            draft_uid = uuid.UUID(body.draft_id)
            d_res = await db.execute(select(Email).where(Email.id == draft_uid, Email.user_id == user.id))
            draft_email = d_res.scalar_one_or_none()
            if draft_email:
                if body.is_draft:
                    draft_email.recipient_emails = body.recipient_emails
                    draft_email.cc_emails = body.cc_emails or []
                    draft_email.bcc_emails = body.bcc_emails or []
                    draft_email.subject = body.subject
                    draft_email.body_text = body.body_text
                    draft_email.body_html = body.body_html or ""
                    draft_email.attachments = body.attachments or []
                    await db.commit()
                    return {"status": "ok", "draft_id": str(draft_email.id)}
                else:
                    await db.delete(draft_email)
        except Exception:
            pass

    folder = "drafts" if body.is_draft else "sent"
    sent_record = Email(
        user_id=user.id,
        sender_email=user.email,
        sender_name=sender_name,
        recipient_emails=body.recipient_emails,
        cc_emails=body.cc_emails or [],
        bcc_emails=body.bcc_emails or [],
        subject=body.subject or "(No Subject)",
        body_text=body.body_text,
        body_html=body.body_html or "",
        folder=folder,
        is_read=True,
        attachments=body.attachments or [],
    )
    db.add(sent_record)
    await db.flush()

    # Deliver to internal recipients if sending
    if not body.is_draft:
        all_targets = set(body.recipient_emails + (body.cc_emails or []) + (body.bcc_emails or []))
        for target_email in all_targets:
            target_email = target_email.strip().lower()
            u_stmt = select(User).where(func.lower(User.email) == target_email)
            u_res = await db.execute(u_stmt)
            recipient_user = u_res.scalar_one_or_none()
            if recipient_user:
                # Add copy to recipient's inbox
                inbox_email = Email(
                    user_id=recipient_user.id,
                    sender_email=user.email,
                    sender_name=sender_name,
                    recipient_emails=body.recipient_emails,
                    cc_emails=body.cc_emails or [],
                    bcc_emails=[],  # hide bcc for recipients
                    subject=body.subject or "(No Subject)",
                    body_text=body.body_text,
                    body_html=body.body_html or "",
                    folder="inbox",
                    is_read=False,
                    attachments=body.attachments or [],
                )
                db.add(inbox_email)
                # Create notification
                notif = Notification(
                    user_id=recipient_user.id,
                    title=f"New email from {sender_name}",
                    message=body.subject or "(No Subject)",
                    type="mail",
                    link=f"/app/mail",
                )
                db.add(notif)

    await db.commit()
    return {"status": "ok", "email_id": str(sent_record.id)}


@router.patch("/{mail_id}")
async def update_email(
    mail_id: str,
    body: UpdateMailRequest,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = uuid.UUID(mail_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid mail ID")

    stmt = select(Email).where(Email.id == uid, Email.user_id == user.id)
    result = await db.execute(stmt)
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if body.folder is not None:
        email.folder = body.folder
    if body.is_read is not None:
        email.is_read = body.is_read
    if body.is_starred is not None:
        email.is_starred = body.is_starred

    await db.commit()
    return {"status": "ok", "id": str(email.id)}


@router.delete("/{mail_id}")
async def delete_email(
    mail_id: str,
    user: CurrentUser,
    permanent: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    try:
        uid = uuid.UUID(mail_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid mail ID")

    stmt = select(Email).where(Email.id == uid, Email.user_id == user.id)
    result = await db.execute(stmt)
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if permanent or email.folder == "trash":
        await db.delete(email)
    else:
        email.folder = "trash"

    await db.commit()
    return {"status": "ok"}

