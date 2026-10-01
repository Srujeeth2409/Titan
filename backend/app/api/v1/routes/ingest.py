"""
Document Ingestion Endpoint for Titan.

POST /v1/ingest
Accepts multipart file uploads (PDF, DOCX, MD, TXT, CSV, JSON),
extracts text, chunks content, generates embeddings, stores metadata in Postgres,
and indexes vectors into Qdrant.
"""
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Chunk, Document
from app.db.session import get_db
from app.services.chunking.service import RecursiveChunking
from app.services.embedding.service import get_embedding_provider
from app.services.ingestion.parser import parse_document
from app.services.retrieval.service import get_retrieval_service

router = APIRouter(tags=["ingestion"])


@router.post("/ingest")
async def ingest_document(
    user: CurrentUser,
    file: UploadFile = File(...),
    collection: str = Form("default"),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a document file, chunk it, embed it, and index it into Qdrant & Postgres.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4001", "message": "Filename cannot be empty"},
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TT-4002", "message": "Uploaded file is empty"},
        )

    try:
        # 1. Parse document into text and structured sections
        full_text, sections = parse_document(file.filename, file_bytes)
        if not full_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "TT-4003", "message": "Could not extract text from document"},
            )

        page_count = max([s.page_number for s in sections if s.page_number is not None], default=1)
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"

        # 2. Record Document in PostgreSQL
        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            filename=file.filename,
            source_type=ext,
            collection=collection,
            status="indexing",
            page_count=page_count,
            chunk_count=0,
            doc_metadata={"file_size": len(file_bytes), "content_type": file.content_type},
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        # 3. Chunk text using Recursive Chunking
        chunker = RecursiveChunking(max_tokens=400, overlap_tokens=50)
        chunk_candidates = chunker.split(full_text)

        if not chunk_candidates:
            doc.status = "empty"
            await db.commit()
            return {"document_id": str(doc.id), "filename": file.filename, "chunks_created": 0, "status": "empty"}

        # 4. Generate embeddings
        chunk_texts = [c.text for c in chunk_candidates]
        embedding_provider = get_embedding_provider()
        vectors = await embedding_provider.embed(chunk_texts)

        # 5. Save Chunks to PostgreSQL & prepare for Qdrant
        qdrant_chunks = []
        db_chunks = []
        for idx, (candidate, vector) in enumerate(zip(chunk_candidates, vectors)):
            chunk_uuid = uuid.uuid4()
            # Determine page/section mapping from sections if available
            sec_name = "General"
            page_num = 1
            if idx < len(sections):
                sec_name = sections[idx].section or sec_name
                page_num = sections[idx].page_number or page_num

            db_chunk = Chunk(
                id=chunk_uuid,
                document_id=doc.id,
                chunk_index=idx,
                text=candidate.text,
                page_number=page_num,
                section=sec_name,
                strategy="recursive",
                token_count=len(candidate.text.split()),
                embedding_model=embedding_provider.model_name,
                vector_id=str(chunk_uuid),
            )
            db_chunks.append(db_chunk)

            qdrant_chunks.append({
                "id": str(chunk_uuid),
                "document_id": str(doc.id),
                "filename": file.filename,
                "text": candidate.text,
                "page_number": page_num,
                "section": sec_name,
                "chunk_index": idx,
            })

        db.add_all(db_chunks)
        doc.status = "indexed"
        doc.chunk_count = len(db_chunks)
        await db.commit()

        # 6. Upsert vectors to Qdrant
        retrieval_service = get_retrieval_service()
        await retrieval_service.upsert_chunks(
            collection_name=collection,
            chunks=qdrant_chunks,
            vectors=vectors,
        )

        return {
            "document_id": str(doc.id),
            "filename": file.filename,
            "collection": collection,
            "chunks_created": len(db_chunks),
            "status": "indexed",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "TT-5001", "message": f"Ingestion failed: {str(e)}"},
        )
