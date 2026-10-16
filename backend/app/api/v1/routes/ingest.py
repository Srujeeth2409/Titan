"""
Document Ingestion Endpoint for Titan.

POST /v1/ingest
Accepts multipart file uploads (PDF, DOCX, MD, TXT, CSV, JSON),
extracts text, chunks content, generates embeddings, stores metadata in Postgres,
and indexes vectors into Qdrant.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Chunk, Document
from app.db.session import get_db
from app.core.config import get_settings
from app.services.chunking.service import ChunkingService, RecursiveChunking, STRATEGY_REGISTRY
from app.services.embedding.service import get_embedding_provider
from app.services.ingestion.log_parser import parse_log
from app.services.ingestion.parser import parse_document
from app.services.retrieval.service import get_retrieval_service

settings = get_settings()

router = APIRouter(tags=["ingestion"])


@router.post("/ingest")
async def ingest_document(
    user: CurrentUser,
    file: UploadFile = File(...),
    collection: str = Form("default"),
    strategy: Optional[str] = Form(None),
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
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "txt"

        # 1. Parse. Logs get a dedicated parser that yields pre-built chunks
        #    (time-windowed, stack traces kept intact); everything else goes
        #    through the prose parser + recursive chunker.
        log_result = parse_log(file.filename, file_bytes)
        doc_metadata = {"file_size": len(file_bytes), "content_type": file.content_type}

        if log_result is not None:
            if not log_result.chunks:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "TT-4003", "message": "No log entries found in file"},
                )
            source_type = "log"
            page_count = 1
            doc_metadata.update({
                "log_format": log_result.log_format,
                "total_entries": log_result.total_entries,
                "time_start": log_result.time_start,
                "time_end": log_result.time_end,
                "level_counts": log_result.level_counts,
            })
            chunk_texts = [c.text for c in log_result.chunks]
            chunk_meta = [
                {
                    "section": c.section,
                    "page_number": None,
                    "strategy": "log_window",
                    "extra": {
                        "time_start": c.time_start,
                        "time_end": c.time_end,
                        "levels": c.levels,
                        "entry_count": c.entry_count,
                        "source_type": "log",
                    },
                }
                for c in log_result.chunks
            ]
        else:
            full_text, sections = parse_document(file.filename, file_bytes)
            if not full_text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "TT-4003", "message": "Could not extract text from document"},
                )
            source_type = ext
            page_count = max([s.page_number for s in sections if s.page_number is not None], default=1)
            active_strategy = strategy or settings.default_chunk_strategy or "recursive"
            try:
                chunker = ChunkingService(strategy=active_strategy, max_tokens=400, overlap_tokens=50)
                candidates = chunker.chunk(full_text)
            except Exception:
                chunker = RecursiveChunking(max_tokens=400, overlap_tokens=50)
                candidates = chunker.split(full_text)
                active_strategy = "recursive"

            chunk_texts = [c.text for c in candidates]
            chunk_meta = []
            for idx, c in enumerate(candidates):
                sec_name = c.section or "General"
                page_num = c.page_number or 1
                if sec_name == "General" and idx < len(sections):
                    sec_name = sections[idx].section or sec_name
                    page_num = sections[idx].page_number or page_num
                chunk_meta.append(
                    {"section": sec_name, "page_number": page_num, "strategy": active_strategy, "extra": {}}
                )

        # 2. Record Document in PostgreSQL
        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            filename=file.filename,
            source_type=source_type,
            collection=collection,
            status="indexing",
            page_count=page_count,
            chunk_count=0,
            doc_metadata=doc_metadata,
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        if not chunk_texts:
            doc.status = "empty"
            await db.commit()
            return {"document_id": str(doc.id), "filename": file.filename, "chunks_created": 0, "status": "empty"}

        # 3. Generate embeddings
        embedding_provider = get_embedding_provider()
        vectors = await embedding_provider.embed(chunk_texts)

        # 4. Save Chunks to PostgreSQL & prepare for Qdrant
        qdrant_chunks = []
        db_chunks = []
        for idx, (text, meta, vector) in enumerate(zip(chunk_texts, chunk_meta, vectors)):
            chunk_uuid = uuid.uuid4()
            db_chunks.append(Chunk(
                id=chunk_uuid,
                document_id=doc.id,
                chunk_index=idx,
                text=text,
                page_number=meta["page_number"],
                section=meta["section"],
                strategy=meta["strategy"],
                token_count=len(text.split()),
                embedding_model=embedding_provider.model_name,
                vector_id=str(chunk_uuid),
            ))
            qdrant_chunks.append({
                "id": str(chunk_uuid),
                "document_id": str(doc.id),
                "filename": file.filename,
                "text": text,
                "page_number": meta["page_number"],
                "section": meta["section"],
                "chunk_index": idx,
                "extra": meta["extra"],
            })

        db.add_all(db_chunks)
        doc.chunk_count = len(db_chunks)
        await db.commit()

        # 6. Upsert vectors to Qdrant
        retrieval_service = get_retrieval_service()
        await retrieval_service.upsert_chunks(
            collection_name=collection,
            chunks=qdrant_chunks,
            vectors=vectors,
        )
        doc.status = "indexed"
        await db.commit()

        return {
            "document_id": str(doc.id),
            "filename": file.filename,
            "collection": collection,
            "chunks_created": len(db_chunks),
            "source_type": source_type,
            "status": "indexed",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "TT-5001", "message": f"Ingestion failed: {str(e)}"},
        )
