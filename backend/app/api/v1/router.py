from fastapi import APIRouter

from app.api.v1.routes import ask, auth, documents, health, ingest

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(ask.router)
api_router.include_router(documents.router)
api_router.include_router(ingest.router)
