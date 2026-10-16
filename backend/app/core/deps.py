"""
FastAPI dependencies for authentication and authorization.
Supports both Authorization: Bearer <token> header and httpOnly access_token cookie.
"""
import uuid
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

# Auto_error=False allows falling back to cookie if Authorization header is absent,
# while registering the OpenAPI Bearer security scheme for Swagger /docs
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)] = None,
    access_token: str | None = Cookie(default=None),
) -> User:
    """
    Extract and validate the access token from Authorization header or httpOnly cookie.
    Returns the current User or raises 401.
    """
    token: str | None = None

    if bearer and bearer.credentials:
        token = bearer.credentials
    elif access_token:
        token = access_token
    else:
        # Fallback manual header check
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.lower().startswith("bearer "):
            token = auth_hdr[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4010", "message": "Not authenticated", "trace_id": ""},
        )

    payload = decode_access_token(token)
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

