"""
Health endpoint.

GET /v1/health → {"status": "ok", "version": "..."}
Per Build Brief Section 7.1.
"""
from fastapi import APIRouter

from app.core.config import get_settings

settings = get_settings()
router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": settings.app_version}
