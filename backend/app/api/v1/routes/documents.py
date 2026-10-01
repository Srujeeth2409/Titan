"""
Documents endpoint.

GET /v1/documents — List indexed documents (Build Brief §7.4)
Protected: requires authentication.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Document
from app.db.session import get_db

router = APIRouter(tags=["documents"])


@router.get("/documents")
async def list_documents(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all indexed documents from the real database."""
    result = await db.execute(
        select(Document).order_by(Document.created_at.desc())
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
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in docs
        ],
        "total": len(docs),
    }
