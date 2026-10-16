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

        # Index into BM25 sparse memory index
        try:
            from app.services.retrieval.bm25 import get_bm25_manager
            bm25_mgr = get_bm25_manager()
            bm25_mgr.index_collection(collection_name, chunks)
        except Exception as e:
            print(f"[Warning] Failed to update BM25 index: {e}")

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

    async def hybrid_search(
        self,
        collection_name: str,
        query: str,
        query_vector: List[float],
        top_k: int = 6,
        dense_weight: float = 0.6,
        sparse_weight: float = 0.4,
        rrf_k: int = 60,
        rerank: bool = True,
    ) -> List[RetrievedChunk]:
        """
        Executes Hybrid Retrieval:
        1. Dense Vector Search (Qdrant)
        2. Sparse Lexical Search (BM25)
        3. Reciprocal Rank Fusion (RRF): score(d) = sum w_i / (k + rank_i(d))
        4. Cross-Encoder / LLM Reranking
        """
        from app.services.retrieval.bm25 import get_bm25_manager

        candidates_k = max(top_k * 3, 20)

        # 1. Dense search
        dense_results = await self.search(collection_name, query_vector, top_k=candidates_k)

        # 2. Sparse BM25 search
        bm25_mgr = get_bm25_manager()
        bm25_idx = bm25_mgr.get_index(collection_name)

        # Self-hydrate BM25 index from Qdrant if empty
        if bm25_idx.corpus_size == 0:
            try:
                scroll_res, _ = await self.client.scroll(
                    collection_name=collection_name,
                    limit=500,
                    with_payload=True,
                )
                cached_chunks = [
                    {
                        "id": pt.payload.get("chunk_id", str(pt.id)),
                        "text": pt.payload.get("text", ""),
                        "filename": pt.payload.get("filename", ""),
                        "document_id": pt.payload.get("document_id", ""),
                        "page_number": pt.payload.get("page_number"),
                        "section": pt.payload.get("section"),
                    }
                    for pt in scroll_res
                    if pt.payload and pt.payload.get("text")
                ]
                if cached_chunks:
                    bm25_idx.index_chunks(cached_chunks)
            except Exception as e:
                print(f"[Warning] Failed to hydrate BM25 from Qdrant: {e}")

        sparse_hits = bm25_idx.search(query, top_k=candidates_k)

        # If no sparse results found, fall back directly to dense
        if not sparse_hits:
            fused = dense_results
            rrf_scores = {c.chunk_id: c.score for c in dense_results}
        else:
            # 3. Reciprocal Rank Fusion (RRF)
            rrf_scores = {}
            chunk_map = {}

            for rank, chunk in enumerate(dense_results):
                chunk_map[chunk.chunk_id] = chunk
                rrf_scores[chunk.chunk_id] = rrf_scores.get(chunk.chunk_id, 0.0) + (
                    dense_weight / (rrf_k + rank + 1)
                )

            for rank, (payload, bm25_score) in enumerate(sparse_hits):
                cid = str(payload.get("id") or payload.get("chunk_id", ""))
                if cid not in chunk_map:
                    chunk_map[cid] = RetrievedChunk(
                        chunk_id=cid,
                        document_id=str(payload.get("document_id", "")),
                        filename=payload.get("filename", "document"),
                        text=payload.get("text", ""),
                        score=float(bm25_score),
                        page_number=payload.get("page_number"),
                        section=payload.get("section"),
                        collection=collection_name,
                    )
                rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (
                    sparse_weight / (rrf_k + rank + 1)
                )

            fused = sorted(
                chunk_map.values(),
                key=lambda c: rrf_scores.get(c.chunk_id, 0.0),
                reverse=True,
            )

        if not fused:
            return []

        # 4. Cross-Encoder / LLM Reranker
        top_candidates = fused[: max(top_k * 2, 12)]
        if rerank and top_candidates:
            try:
                from app.services.reranking.service import get_reranker
                reranker = get_reranker()
                passages = [c.text for c in top_candidates]
                ranked_indices = await reranker.rerank(query, passages, top_n=top_k)
                final_chunks = [
                    top_candidates[i] for i in ranked_indices if i < len(top_candidates)
                ]
            except Exception as e:
                print(f"[Warning] Reranker failed, using RRF order: {e}")
                final_chunks = top_candidates[:top_k]
        else:
            final_chunks = fused[:top_k]

        # Rescale scores nicely for confidence calculation
        max_s = max((rrf_scores.get(c.chunk_id, c.score) for c in final_chunks), default=1.0)
        if max_s <= 0:
            max_s = 1.0

        for idx, c in enumerate(final_chunks):
            raw = rrf_scores.get(c.chunk_id, c.score)
            scaled = (raw / max_s) * (1.0 - (idx * 0.04))
            c.score = round(min(1.0, max(0.35, scaled)), 3)

        return final_chunks


_global_retrieval_service: QdrantVectorService | None = None


def get_retrieval_service() -> QdrantVectorService:
    global _global_retrieval_service
    if _global_retrieval_service is None:
        _global_retrieval_service = QdrantVectorService()
    return _global_retrieval_service
