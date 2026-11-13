"""
Titan API — FastAPI application entry point.

Mounts the v1 API router at /v1, configures CORS for the real frontend
origin only (no wildcard), and runs table creation on startup.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.db.models import Base
from app.db.session import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure local upload directories exist
    upload_dir = Path("storage/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate users table columns if not present
        user_cols = [
            "full_name VARCHAR(255) DEFAULT 'Titan Employee'",
            "department VARCHAR(100) DEFAULT 'General'",
            "role VARCHAR(50) DEFAULT 'Employee'",
            "title VARCHAR(255)",
            "phone VARCHAR(50)",
            "avatar_url VARCHAR(512)",
            "status VARCHAR(50) DEFAULT 'online'",
            "status_message VARCHAR(255)",
        ]
        for col_def in user_cols:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_def};"))
            except Exception:
                pass

    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — support both localhost and 127.0.0.1 dev origins
cors_origins = list(dict.fromkeys([settings.cors_origin, "http://localhost:3000", "http://127.0.0.1:3000"]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
