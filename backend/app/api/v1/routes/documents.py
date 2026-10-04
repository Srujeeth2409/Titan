
"""
Documents endpoint.

GET /v1/documents — List indexed documents.
Protected: requires authentication.
Documents are isolated by the authenticated user's workspace.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Document, Workspace
from app.db.session import get_db

router = APIRouter(tags=["documents"])


async def get_user_workspace(
    db: AsyncSession,
    user_id,
) -> Workspace:
    """Resolve the authenticated user's default workspace."""

    result = await db.execute(
        select(Workspace)
        .where(Workspace.created_by_user_id == user_id)
        .order_by(Workspace.created_at.asc(), Workspace.id.asc())
        .limit(1)
    )

    workspace = result.scalars().first()

    if workspace is None:
        raise HTTPException(
            status_code=403,
            detail="No workspace is assigned to this user.",
        )

    return workspace


@router.get("/documents")
async def list_documents(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return documents belonging only to the user's workspace."""

    workspace = await get_user_workspace(db, user.id)

    result = await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace.id)
        .order_by(Document.created_at.desc())
    )

    docs = result.scalars().all()

    return {
        "documents": [
            {
                "id": str(doc.id),
                "filename": doc.filename,
                "source_type": doc.source_type,
                "collection": doc.collection,
                "status": doc.status,
                "page_count": doc.page_count,
                "chunk_count": doc.chunk_count,
                "metadata": doc.doc_metadata,
                "created_at": (
                    doc.created_at.isoformat()
                    if doc.created_at else None
                ),
                "updated_at": (
                    doc.updated_at.isoformat()
                    if doc.updated_at else None
                ),
            }
            for doc in docs
        ],
        "total": len(docs),
    }