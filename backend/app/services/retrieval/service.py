
"""
Retrieval Service for Titan.

Connects to Qdrant, manages vector collections,
upserts embedded document chunks, and performs workspace-isolated
semantic search.
"""

from dataclasses import dataclass
from typing import List, Optional
import math
import uuid

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import get_settings


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    filename: str
    text: str
    score: float
    page_number: Optional[int] = None
    section: Optional[str] = None
    collection: str = "default"


def validate_workspace_id(workspace_id: str | uuid.UUID) -> str:
    """Validate and normalize a workspace UUID."""
    try:
        return str(uuid.UUID(str(workspace_id)))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("A valid workspace_id UUID is required")


class QdrantVectorService:

    def __init__(self, url: str | None = None):
        settings = get_settings()
        self.url = url or settings.qdrant_url
        self.client = AsyncQdrantClient(url=self.url)

    async def ensure_collection(
        self,
        collection_name: str,
        vector_dim: int = 384,
    ):
        """Create a collection or verify its existing configuration."""

        if not collection_name or not collection_name.strip():
            raise ValueError("Collection name cannot be empty")

        if vector_dim <= 0:
            raise ValueError("Vector dimension must be positive")

        collections = await self.client.get_collections()

        existing_names = {
            collection.name for collection in collections.collections
        }

        if collection_name not in existing_names:
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config=qmodels.VectorParams(
                    size=vector_dim,
                    distance=qmodels.Distance.COSINE,
                ),
            )
            return

        collection_info = await self.client.get_collection(
            collection_name=collection_name
        )

        existing_vectors = collection_info.config.params.vectors

        # This implementation currently supports unnamed vectors.
        if isinstance(existing_vectors, dict):
            raise ValueError(
                f"Collection '{collection_name}' uses named vectors. "
                "This ingestion service currently expects unnamed vectors."
            )

        if existing_vectors.size != vector_dim:
            raise ValueError(
                f"Vector dimension mismatch for collection "
                f"'{collection_name}': existing={existing_vectors.size}, "
                f"requested={vector_dim}"
            )

        if existing_vectors.distance != qmodels.Distance.COSINE:
            raise ValueError(
                f"Collection '{collection_name}' does not use cosine distance"
            )

    async def upsert_chunks(
        self,
        collection_name: str,
        chunks: List[dict],
        vectors: List[List[float]],
        *,
        workspace_id: str | uuid.UUID,
    ):
        """
        Validate and insert document chunk vectors into Qdrant.

        Every point is tagged with its owning workspace.
        """

        workspace_uuid = validate_workspace_id(workspace_id)

        if len(chunks) != len(vectors):
            raise ValueError(
                f"Chunk/vector count mismatch: "
                f"{len(chunks)} chunks and {len(vectors)} vectors"
            )

        if not chunks:
            return

        if not vectors:
            raise ValueError("No embedding vectors supplied")

        dimension = len(vectors[0])

        if dimension == 0:
            raise ValueError("Embedding vectors cannot be empty")

        for index, (chunk, vector) in enumerate(zip(chunks, vectors)):

            if not isinstance(chunk, dict):
                raise ValueError(f"Invalid chunk at index {index}")

            if not isinstance(vector, list):
                raise ValueError(f"Invalid vector at index {index}")

            if len(vector) != dimension:
                raise ValueError(
                    f"Inconsistent vector dimension at index {index}: "
                    f"expected {dimension}, received {len(vector)}"
                )

            if not all(
                isinstance(value, (int, float))
                and math.isfinite(value)
                for value in vector
            ):
                raise ValueError(
                    f"Invalid numerical values in vector at index {index}"
                )

            if not isinstance(chunk.get("text"), str) or not chunk["text"].strip():
                raise ValueError(f"Chunk text is empty at index {index}")

            if not chunk.get("document_id"):
                raise ValueError(f"Missing document ID at index {index}")

            if not chunk.get("id"):
                raise ValueError(f"Missing chunk ID at index {index}")

        await self.ensure_collection(
            collection_name,
            vector_dim=dimension,
        )

        points = []

        for chunk, vector in zip(chunks, vectors):

            try:
                point_id = str(uuid.UUID(str(chunk["id"])))
            except (ValueError, TypeError, AttributeError):
                raise ValueError(
                    f"Invalid chunk UUID: {chunk.get('id')}"
                )

            payload = {
                "chunk_id": point_id,
                "document_id": str(chunk["document_id"]),
                "workspace_id": workspace_uuid,
                "filename": chunk.get("filename", ""),
                "collection": collection_name,
                "text": chunk["text"],
                "page_number": chunk.get("page_number"),
                "section": chunk.get("section"),
                "chunk_index": chunk.get("chunk_index", 0),
            }

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        result = await self.client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True,
        )

        if result.status != qmodels.UpdateStatus.COMPLETED:
            raise RuntimeError(
                f"Qdrant upsert did not complete: {result.status}"
            )

        return result

    async def search(
        self,
        collection_name: str,
        query_vector: List[float],
        *,
        workspace_id: str | uuid.UUID,
        top_k: int = 6,
    ) -> List[RetrievedChunk]:
        """
        Search Qdrant only within the specified workspace.
        """

        workspace_uuid = validate_workspace_id(workspace_id)

        if not query_vector:
            raise ValueError("Query vector cannot be empty")

        if top_k <= 0:
            raise ValueError("top_k must be positive")

        if not all(
            isinstance(value, (int, float)) and math.isfinite(value)
            for value in query_vector
        ):
            raise ValueError("Query vector contains invalid numerical values")

        await self.ensure_collection(
            collection_name,
            vector_dim=len(query_vector),
        )

        # Restrict vector search to the authenticated user's workspace.
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="workspace_id",
                    match=qmodels.MatchValue(value=workspace_uuid),
                )
            ]
        )

        results = await self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=top_k,
        )

        retrieved = []

        for hit in results:
            payload = hit.payload or {}

            retrieved.append(
                RetrievedChunk(
                    chunk_id=payload.get("chunk_id", str(hit.id)),
                    document_id=payload.get("document_id", ""),
                    filename=payload.get("filename", "document"),
                    text=payload.get("text", ""),
                    score=float(hit.score),
                    page_number=payload.get("page_number"),
                    section=payload.get("section"),
                    collection=payload.get(
                        "collection",
                        collection_name,
                    ),
                )
            )

        return retrieved


_global_retrieval_service: QdrantVectorService | None = None


def get_retrieval_service() -> QdrantVectorService:
    global _global_retrieval_service

    if _global_retrieval_service is None:
        _global_retrieval_service = QdrantVectorService()

    return _global_retrieval_service