"""
Retrieval Service for Titan.

Connects to Qdrant vector database, ensures collections exist,
upserts embedded document chunks, and executes semantic vector search.
"""
from dataclasses import dataclass
from typing import List, Optional
import uuid

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import get_settings

settings = get_settings()


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


class QdrantVectorService:
    def __init__(self, url: str | None = None):
        self.url = url or settings.qdrant_url
        self.client = AsyncQdrantClient(url=self.url)

    async def ensure_collection(self, collection_name: str, vector_dim: int = 384):
        """Creates the Qdrant collection if it does not already exist."""
        try:
            collections = await self.client.get_collections()
            existing_names = [c.name for c in collections.collections]
            if collection_name not in existing_names:
                await self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=vector_dim,
                        distance=qmodels.Distance.COSINE,
                    ),
                )
        except Exception as e:
            # If Qdrant is unreachable, log warning
            print(f"[Warning] Failed to ensure collection in Qdrant: {e}")

    async def upsert_chunks(
        self,
        collection_name: str,
        chunks: List[dict],
        vectors: List[List[float]],
    ):
        """
        Upsert a batch of document chunks and their embedding vectors into Qdrant.
        """
        if not chunks or not vectors:
            return

        dim = len(vectors[0])
        await self.ensure_collection(collection_name, vector_dim=dim)

        points = []
        for chunk, vector in zip(chunks, vectors):
            point_id = str(chunk.get("id") or uuid.uuid4())
            payload = {
                "chunk_id": point_id,
                "document_id": str(chunk.get("document_id", "")),
                "filename": chunk.get("filename", ""),
                "collection": collection_name,
                "text": chunk.get("text", ""),
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

        await self.client.upsert(
            collection_name=collection_name,
            points=points,
        )

    async def search(
        self,
        collection_name: str,
        query_vector: List[float],
        top_k: int = 6,
    ) -> List[RetrievedChunk]:
        """
        Search Qdrant for top-K semantically similar chunks.
        """
        try:
            await self.ensure_collection(collection_name, vector_dim=len(query_vector))
            results = await self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
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
                        collection=payload.get("collection", collection_name),
                    )
                )
            return retrieved
        except Exception as e:
            print(f"[Error] Qdrant search error: {e}")
            return []


_global_retrieval_service: QdrantVectorService | None = None


def get_retrieval_service() -> QdrantVectorService:
    global _global_retrieval_service
    if _global_retrieval_service is None:
        _global_retrieval_service = QdrantVectorService()
    return _global_retrieval_service
