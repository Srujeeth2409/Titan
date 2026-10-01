"""
Authentication endpoints.

POST /v1/auth/signup   — Create account (Argon2id hash)
POST /v1/auth/login    — Authenticate, set httpOnly cookies
POST /v1/auth/refresh  — Rotate refresh token, issue new access token
POST /v1/auth/logout   — Revoke refresh token server-side
GET  /v1/auth/me       — Return current user

All per Build Brief Section 5.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.security import (
    create_access_token,
    generate_family_id,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.models import AuditLog, RefreshToken, User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, SignupRequest, UserResponse
from app.services.rate_limit import check_login_rate_limit, record_failed_login

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly/Secure/SameSite cookies for both tokens."""
    is_prod = settings.environment == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/v1/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear auth cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/v1/auth")


async def _log_audit(
    db: AsyncSession,
    action: str,
    resource: str,
    ip: str | None,
    user_id: uuid.UUID | None = None,
    details: dict | None = None,
) -> None:
    """Write to the audit log."""
    db.add(AuditLog(
        actor_user_id=user_id,
        action=action,
        resource=resource,
        ip_address=ip,
        details=details or {},
    ))
    await db.flush()


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Create a new user account with Argon2id-hashed password."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TT-4090", "message": "Email already registered", "trace_id": ""},
        )

    hashed = hash_password(body.password)
    user = User(email=body.email, hashed_password=hashed)
    db.add(user)
    await db.flush()

    access = create_access_token(str(user.id), user.email)
    refresh = generate_refresh_token()
    family_id = generate_family_id()

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh),
        family_id=family_id,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
    ))

    await _log_audit(db, "signup", "auth", request.client.host if request.client else None, user.id)
    await db.commit()

    _set_auth_cookies(response, access, refresh)

    return UserResponse(id=str(user.id), email=user.email)


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Authenticate with email + password. Sets httpOnly cookies."""
    client_ip = request.client.host if request.client else "unknown"

    await check_login_rate_limit(body.email, client_ip)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        await record_failed_login(body.email, client_ip)
        await _log_audit(db, "login_failed", "auth", client_ip, details={"email": body.email})
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4010", "message": "Invalid email or password", "trace_id": ""},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4014", "message": "Account is disabled", "trace_id": ""},
        )

    access = create_access_token(str(user.id), user.email)
    refresh = generate_refresh_token()
    family_id = generate_family_id()

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(refresh),
        family_id=family_id,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
    ))

    await _log_audit(db, "login_success", "auth", client_ip, user.id)
    await db.commit()

    _set_auth_cookies(response, access, refresh)

    return UserResponse(id=str(user.id), email=user.email)


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> dict:
    """
    Rotate the refresh token. Issues a new access + refresh token pair
    and immediately invalidates the old refresh token. If a revoked token
    is reused, the entire family is revoked (stolen token detection).
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4010", "message": "No refresh token", "trace_id": ""},
        )

    token_hash = hash_refresh_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4015", "message": "Invalid refresh token", "trace_id": ""},
        )

    if stored.is_revoked:
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == stored.family_id)
            .values(is_revoked=True)
        )
        await db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4016", "message": "Token reuse detected, session revoked", "trace_id": ""},
        )

    if stored.expires_at < datetime.utcnow():
        stored.is_revoked = True
        await db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4017", "message": "Refresh token expired", "trace_id": ""},
        )

    stored.is_revoked = True

    user_result = await db.execute(select(User).where(User.id == stored.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        await db.commit()
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4013", "message": "User not found or inactive", "trace_id": ""},
        )

    new_access = create_access_token(str(user.id), user.email)
    new_refresh = generate_refresh_token()

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(new_refresh),
        family_id=stored.family_id,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
    ))

    client_ip = request.client.host if request.client else None
    await _log_audit(db, "token_refresh", "auth", client_ip, user.id)
    await db.commit()

    _set_auth_cookies(response, new_access, new_refresh)

    return {"status": "ok"}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
) -> dict:
    """Revoke the refresh token server-side and clear cookies."""
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        if stored:
            stored.is_revoked = True
            client_ip = request.client.host if request.client else None
            await _log_audit(db, "logout", "auth", client_ip, stored.user_id)
            await db.commit()

    _clear_auth_cookies(response)
    return {"status": "ok"}


@router.get("/me")
async def me(user: CurrentUser) -> UserResponse:
    """Return the current authenticated user."""
    return UserResponse(id=str(user.id), email=user.email)
