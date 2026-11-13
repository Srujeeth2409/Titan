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


@router.patch("/documents/{document_id}/move")
async def move_document(
    document_id: str,
    payload: dict,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Move a document to another folder/collection."""
    import uuid
    from fastapi import HTTPException, status
    from sqlalchemy import update
    from app.db.models import Document, Chunk
    from app.services.retrieval.service import get_retrieval_service
    from qdrant_client.http import models as qmodels

    target_collection = payload.get("collection")
    if not target_collection or not isinstance(target_collection, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4002", "message": "Target collection name is required"},
        )

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

    old_collection = doc.collection
    target_collection = target_collection.strip()

    # Update Postgres Document record
    doc.collection = target_collection
    await db.commit()

    # Update Qdrant vectors if collection exists
    try:
        retriever = get_retrieval_service()
        # Set payload for chunk points
        await retriever.client.set_payload(
            collection_name=old_collection,
            payload={"collection": target_collection},
            points=qmodels.FilterSelector(
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
        pass

    return {
        "status": "moved",
        "id": document_id,
        "filename": doc.filename,
        "from_collection": old_collection,
        "to_collection": target_collection,
    }


@router.post("/documents/{document_id}/copy")
async def copy_document(
    document_id: str,
    payload: dict,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Copy an existing document and its chunk vectors into a target folder/collection."""
    import uuid
    from fastapi import HTTPException, status
    from app.db.models import Document, Chunk
    from app.services.retrieval.service import get_retrieval_service
    from qdrant_client.http import models as qmodels

    target_collection = payload.get("collection")
    if not target_collection or not isinstance(target_collection, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4002", "message": "Target collection name is required"},
        )

    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4001", "message": "Invalid document ID format"},
        )

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    orig_doc = result.scalar_one_or_none()
    if not orig_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TT-4040", "message": "Document not found"},
        )

    target_collection = target_collection.strip()

    # 1. Create a new Document record for the target folder
    new_doc_id = uuid.uuid4()
    new_doc = Document(
        id=new_doc_id,
        filename=orig_doc.filename,
        source_type=orig_doc.source_type,
        collection=target_collection,
        status=orig_doc.status,
        chunk_count=orig_doc.chunk_count,
        page_count=orig_doc.page_count,
        doc_metadata=orig_doc.doc_metadata,
    )
    db.add(new_doc)
    await db.flush()

    # 2. Duplicate chunks in PostgreSQL
    chunk_res = await db.execute(
        select(Chunk).where(Chunk.document_id == doc_uuid).order_by(Chunk.chunk_index.asc())
    )
    orig_chunks = chunk_res.scalars().all()

    new_chunks = []
    chunk_point_pairs = []  # (orig_chunk_id, new_chunk_id, text, metadata)
    for c in orig_chunks:
        new_chunk_id = uuid.uuid4()
        new_c = Chunk(
            id=new_chunk_id,
            document_id=new_doc_id,
            chunk_index=c.chunk_index,
            text=c.text,
            token_count=c.token_count,
            page_number=c.page_number,
            section=c.section,
            strategy=c.strategy or "recursive",
            embedding_model=c.embedding_model,
            vector_id=str(new_chunk_id),
        )
        new_chunks.append(new_c)
        chunk_point_pairs.append((str(c.id), str(new_chunk_id), c.text, {"section": c.section, "page": c.page_number}))

    db.add_all(new_chunks)
    await db.commit()

    # 3. Duplicate vectors in Qdrant and BM25 index for RAG search
    try:
        retriever = get_retrieval_service()
        # Ensure target Qdrant collection exists
        await retriever.ensure_collection(target_collection, vector_dim=384)

        # Retrieve vectors from original collection and copy to target
        copied_qdrant_chunks = []
        for orig_c_id, new_c_id, text, meta in chunk_point_pairs:
            pts = await retriever.client.retrieve(
                collection_name=orig_doc.collection,
                ids=[orig_c_id],
                with_vectors=True,
                with_payload=True,
            )
            if pts and len(pts) > 0 and pts[0].vector is not None:
                vec = pts[0].vector
                new_payload = dict(pts[0].payload or {})
                new_payload["chunk_id"] = new_c_id
                new_payload["document_id"] = str(new_doc_id)
                new_payload["collection"] = target_collection
                new_payload["filename"] = new_doc.filename

                await retriever.client.upsert(
                    collection_name=target_collection,
                    points=[
                        qmodels.PointStruct(
                            id=new_c_id,
                            vector=vec,
                            payload=new_payload,
                        )
                    ],
                )
                copied_qdrant_chunks.append({
                    "id": new_c_id,
                    "text": text,
                    "filename": new_doc.filename,
                    "document_id": str(new_doc_id),
                    "page_number": new_payload.get("page_number"),
                    "section": new_payload.get("section"),
                })

        # Also register with BM25 manager for hybrid search
        if copied_qdrant_chunks:
            from app.services.retrieval.bm25 import get_bm25_manager
            bm25_mgr = get_bm25_manager()
            bm25_mgr.index_collection(target_collection, copied_qdrant_chunks)
    except Exception as e:
        print(f"[CopyDocument] Vector copy error: {e}")

    return {
        "status": "copied",
        "id": str(new_doc_id),
        "filename": new_doc.filename,
        "from_collection": orig_doc.collection,
        "to_collection": target_collection,
    }


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Download the document file or its text content."""
    import uuid
    from pathlib import Path
    from fastapi import HTTPException
    from fastapi.responses import FileResponse, Response
    from app.db.models import Document, Chunk

    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID format")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_path = (doc.doc_metadata or {}).get("storage_path")
    if storage_path and Path(storage_path).exists():
        return FileResponse(path=Path(storage_path), filename=doc.filename)

    upload_file = Path(f"storage/uploads/{doc.id}_{doc.filename}")
    if upload_file.exists():
        return FileResponse(path=upload_file, filename=doc.filename)

    # Fallback to chunk texts
    c_res = await db.execute(
        select(Chunk).where(Chunk.document_id == doc_uuid).order_by(Chunk.chunk_index.asc())
    )
    chunks = c_res.scalars().all()
    full_text = "\n\n".join(c.text for c in chunks)
    return Response(
        content=full_text.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}.txt"'},
    )


