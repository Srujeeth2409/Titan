"""
Authentication for log ingestion agents (Fluent Bit, Vector, custom shippers).

Uses a shared secret via the X-Log-Ingest-Key header so services can push
logs without a user session cookie.
"""
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


async def verify_log_ingest_key(
    x_log_ingest_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.log_ingest_api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "TT-5031",
                "message": "Log ingest is not configured (LOG_INGEST_API_KEY)",
            },
        )
    if not x_log_ingest_key or x_log_ingest_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TT-4014", "message": "Invalid or missing log ingest API key"},
        )
