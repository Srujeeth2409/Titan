from fastapi import APIRouter

from app.api.v1.routes import (
    announcements,
    ask,
    auth,
    calendar,
    documents,
    directory,
    global_search,
    health,
    ingest,
    logs,
    mail,
    meetings,
    notes,
    notifications,
    tasks,
    workspace_chat,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(ask.router)
api_router.include_router(documents.router)
api_router.include_router(ingest.router)
api_router.include_router(logs.router)

# Enterprise Workspace Routers
api_router.include_router(mail.router)
api_router.include_router(workspace_chat.router)
api_router.include_router(calendar.router)
api_router.include_router(meetings.router)
api_router.include_router(tasks.router)
api_router.include_router(directory.router)
api_router.include_router(notes.router)
api_router.include_router(announcements.router)
api_router.include_router(notifications.router)
api_router.include_router(global_search.router)
