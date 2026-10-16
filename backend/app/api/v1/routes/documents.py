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


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete a document and its chunks from PostgreSQL and Qdrant."""
    import uuid
    from fastapi import HTTPException, status
    from sqlalchemy import delete
    from app.db.models import Chunk
    from app.services.retrieval.service import get_retrieval_service
    from qdrant_client.http import models as qmodels

    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4001", "message": "Invalid document ID format"},
        )

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TT-4040", "message": "Document not found"},
        )

    # 1. Delete vectors from Qdrant
    try:
        retriever = get_retrieval_service()
        await retriever.client.delete(
            collection_name=doc.collection,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="document_id",
                            match=qmodels.MatchValue(value=str(doc.id)),
                        )
                    ]
                )
            ),
        )
    except Exception:
        pass  # If Qdrant points don't exist or collection absent, proceed

    # 2. Delete chunks from Postgres
    await db.execute(delete(Chunk).where(Chunk.document_id == doc_uuid))

    # 3. Delete document from Postgres
    await db.execute(delete(Document).where(Document.id == doc_uuid))
    await db.commit()

    return {"status": "deleted", "id": document_id, "filename": doc.filename}

