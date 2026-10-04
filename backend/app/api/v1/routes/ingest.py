
"""
Document Ingestion Endpoint for Titan.

TXT upload -> text extraction -> chunking -> BGE embeddings
-> PostgreSQL metadata -> workspace-isolated Qdrant indexing.
"""

import os
import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser
from app.db.models import Chunk, Document, Workspace
from app.db.session import get_db
from app.services.chunking.service import RecursiveChunking
from app.services.embedding.service import get_embedding_provider
from app.services.ingestion.parser import parse_document
from app.services.retrieval.service import get_retrieval_service


router = APIRouter(tags=["ingestion"])

MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_COLLECTION_LENGTH = 64


def error_response(code: str, message: str):
    return {
        "code": code,
        "message": message,
    }


async def get_user_workspace(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> Workspace:
    """
    Resolve the user's default workspace.

    For the current MVP, the oldest workspace assigned to the
    authenticated user is selected.
    """

    result = await db.execute(
        select(Workspace)
        .where(Workspace.created_by_user_id == user_id)
        .order_by(
            Workspace.created_at.asc(),
            Workspace.id.asc(),
        )
        .limit(1)
    )

    workspace = result.scalar_one_or_none()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_response(
                "TT-4030",
                "No workspace is assigned to this account",
            ),
        )

    return workspace


@router.post("/ingest")
async def ingest_document(
    user: CurrentUser,
    file: UploadFile = File(...),
    collection: str = Form("default"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and index a TXT document using BGE and Qdrant.

    The workspace is always resolved from the authenticated user.
    """

    doc_id = None

    try:
        # -------------------------------------------------
        # 1. Resolve authenticated user's workspace
        # -------------------------------------------------

        workspace = await get_user_workspace(db, user.id)
        workspace_id = str(workspace.id)

        # -------------------------------------------------
        # 2. Validate filename and file type
        # -------------------------------------------------

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4001",
                    "Filename cannot be empty",
                ),
            )

        filename = os.path.basename(
            file.filename.replace("\\", "/")
        )

        if not filename or filename in (".", ".."):
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4001",
                    "Invalid filename",
                ),
            )

        extension = os.path.splitext(filename)[1].lower()

        if extension != ".txt":
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4004",
                    "Only TXT files are supported in this milestone",
                ),
            )

        # -------------------------------------------------
        # 3. Validate collection name
        # -------------------------------------------------

        if (
            not collection
            or len(collection) > MAX_COLLECTION_LENGTH
            or not re.fullmatch(r"[A-Za-z0-9_-]+", collection)
        ):
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4005",
                    "Invalid collection name",
                ),
            )

        # -------------------------------------------------
        # 4. Read upload with size limit
        # -------------------------------------------------

        file_bytes = await file.read(MAX_FILE_SIZE + 1)

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4002",
                    "Uploaded file is empty",
                ),
            )

        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=error_response(
                    "TT-4006",
                    "File exceeds the 5 MB upload limit",
                ),
            )

        # -------------------------------------------------
        # 5. Validate UTF-8 encoding
        # -------------------------------------------------

        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4007",
                    "TXT file must use valid UTF-8 encoding",
                ),
            )

        # -------------------------------------------------
        # 6. Extract document text
        # -------------------------------------------------

        full_text, sections = parse_document(
            filename,
            file_bytes,
        )

        if not full_text.strip():
            raise HTTPException(
                status_code=400,
                detail=error_response(
                    "TT-4003",
                    "Document does not contain readable text",
                ),
            )

        # -------------------------------------------------
        # 7. Create workspace-owned document record
        # -------------------------------------------------

        doc_id = uuid.uuid4()

        doc = Document(
            id=doc_id,
            workspace_id=workspace.id,
            filename=filename,
            source_type="txt",
            collection=collection,
            status="indexing",
            page_count=1,
            chunk_count=0,
            doc_metadata={
                "file_size": len(file_bytes),
                "content_type": file.content_type,
                "embedding_model": None,
            },
        )

        db.add(doc)
        await db.commit()

        # -------------------------------------------------
        # 8. Generate chunks
        # -------------------------------------------------

        chunker = RecursiveChunking(
            max_tokens=400,
            overlap_tokens=50,
        )

        chunk_candidates = chunker.split(full_text)

        if not chunk_candidates:
            doc.status = "empty"
            await db.commit()

            return {
                "document_id": str(doc_id),
                "filename": filename,
                "collection": collection,
                "workspace_id": workspace_id,
                "chunks_created": 0,
                "status": "empty",
            }

        # -------------------------------------------------
        # 9. Generate BGE embeddings
        # -------------------------------------------------

        embedding_provider = get_embedding_provider()

        chunk_texts = [
            candidate.text
            for candidate in chunk_candidates
        ]

        vectors = await embedding_provider.embed(chunk_texts)

        if len(vectors) != len(chunk_candidates):
            raise RuntimeError(
                "Embedding count does not match chunk count"
            )

        expected_dimension = embedding_provider.dimensions

        for index, vector in enumerate(vectors):
            if len(vector) != expected_dimension:
                raise RuntimeError(
                    f"Invalid embedding dimension at chunk {index}"
                )

        # -------------------------------------------------
        # 10. Prepare PostgreSQL and Qdrant records
        # -------------------------------------------------

        db_chunks = []
        qdrant_chunks = []

        for index, candidate in enumerate(chunk_candidates):

            chunk_id = uuid.uuid4()

            section_name = "Document"

            if sections and sections[0].section:
                section_name = sections[0].section

            page_number = 1

            db_chunk = Chunk(
                id=chunk_id,
                document_id=doc_id,
                chunk_index=index,
                text=candidate.text,
                page_number=page_number,
                section=section_name,
                strategy="recursive",
                token_count=len(candidate.text.split()),
                embedding_model=embedding_provider.model_name,
                vector_id=str(chunk_id),
            )

            db_chunks.append(db_chunk)

            qdrant_chunks.append({
                "id": str(chunk_id),
                "document_id": str(doc_id),
                "filename": filename,
                "text": candidate.text,
                "page_number": page_number,
                "section": section_name,
                "chunk_index": index,
            })

        # -------------------------------------------------
        # 11. Save chunks in PostgreSQL
        # -------------------------------------------------

        db.add_all(db_chunks)
        await db.flush()

        # -------------------------------------------------
        # 12. Index vectors in workspace-filtered Qdrant
        # -------------------------------------------------

        retrieval_service = get_retrieval_service()

        await retrieval_service.upsert_chunks(
            collection_name=collection,
            chunks=qdrant_chunks,
            vectors=vectors,
            workspace_id=workspace_id,
        )

        # -------------------------------------------------
        # 13. Mark document indexed after Qdrant succeeds
        # -------------------------------------------------

        doc.status = "indexed"
        doc.chunk_count = len(db_chunks)

        doc.doc_metadata = {
            **(doc.doc_metadata or {}),
            "embedding_model": embedding_provider.model_name,
            "embedding_dimensions": expected_dimension,
        }

        await db.commit()

        return {
            "document_id": str(doc_id),
            "filename": filename,
            "collection": collection,
            "workspace_id": workspace_id,
            "chunks_created": len(db_chunks),
            "embedding_model": embedding_provider.model_name,
            "embedding_dimensions": expected_dimension,
            "status": "indexed",
        }

    except HTTPException:
        await db.rollback()
        raise

    except Exception as exc:
        await db.rollback()

        # Attempt to record failure in PostgreSQL.
        if doc_id is not None:
            try:
                result = await db.execute(
                    select(Document).where(Document.id == doc_id)
                )

                failed_doc = result.scalar_one_or_none()

                if failed_doc is not None:
                    failed_doc.status = "failed"
                    await db.commit()

            except Exception:
                await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response(
                "TT-5001",
                f"Ingestion failed: {str(exc)}",
            ),
        ) from exc

    finally:
        await file.close()