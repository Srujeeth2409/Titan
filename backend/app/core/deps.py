"""
FastAPI dependencies for authentication and authorization.
"""
import uuid
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: str | None = Cookie(default=None),
) -> User:
    """
    Extract and validate the access token from httpOnly cookie.
    Returns the current User or raises 401.
    """
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4010", "message": "Not authenticated", "trace_id": ""},
        )

    payload = decode_access_token(access_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4011", "message": "Invalid or expired token", "trace_id": ""},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4012", "message": "Invalid token payload", "trace_id": ""},
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4013", "message": "User not found or inactive", "trace_id": ""},
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
