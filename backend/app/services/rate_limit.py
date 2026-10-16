"""
Redis-backed login rate limiting.

Lock an email+IP combination out for 15 minutes after 5 failed attempts
in 10 minutes, per Build Brief Section 5.
"""
import redis.asyncio as aioredis
from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()


def _get_redis() -> aioredis.Redis:
    """Lazy Redis client."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)


def _rate_key(email: str, ip: str) -> str:
    return f"titan:login_attempts:{email}:{ip}"


def _lockout_key(email: str, ip: str) -> str:
    return f"titan:login_lockout:{email}:{ip}"


async def check_login_rate_limit(email: str, ip: str) -> None:
    """
    Raise 429 if the email+IP combination is locked out.
    """
    try:
        r = _get_redis()
        locked = await r.get(_lockout_key(email, ip))
        if locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "TT-4290",
                    "message": "Too many login attempts. Try again in 15 minutes.",
                    "trace_id": "",
                },
            )
        await r.aclose()
    except HTTPException:
        raise
    except Exception:
        # If Redis is down, allow the request through — fail open for auth
        pass


async def record_failed_login(email: str, ip: str) -> None:
    """
    Increment failed login count. If threshold reached, set lockout.
    """
    try:
        r = _get_redis()
        key = _rate_key(email, ip)
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, settings.login_rate_limit_window_minutes * 60)

        if count >= settings.login_rate_limit_attempts:
            await r.setex(
                _lockout_key(email, ip),
                settings.login_lockout_minutes * 60,
                "1",
            )
            await r.delete(key)
        await r.aclose()
    except Exception:
        # If Redis is down, skip rate limiting — fail open
        pass
