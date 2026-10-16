import time
import uuid

from fastapi import APIRouter

from app.schemas.query import RetrievalStrategy, SearchRequest, SearchResponse, SearchResult
from app.services.embedding.service import get_embedding_provider
from app.services.retrieval.service import get_retrieval_service

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    start = time.perf_counter()
    trace_id = str(uuid.uuid4())

    collection_name = str(payload.workspace_id) if payload.workspace_id else "default"

    # 1. Embed query
    embedder = get_embedding_provider()
    query_vectors = await embedder.embed([payload.query])
    query_vector = query_vectors[0]

    # 2. Retrieve candidates
    retriever = get_retrieval_service()
    top_k = payload.top_k or 20

    if payload.strategy == RetrievalStrategy.DENSE:
        chunks = await retriever.search(
            collection_name=collection_name,
            query_vector=query_vector,
            top_k=top_k,
        )
    else:
        # Default HYBRID (Dense + BM25 + RRF + Reranker)
        chunks = await retriever.hybrid_search(
            collection_name=collection_name,
            query=payload.query,
            query_vector=query_vector,
            top_k=payload.rerank_top_n if payload.rerank else top_k,
            rerank=payload.rerank,
        )

    # 3. Format real search results
    results = []
    for rank_idx, c in enumerate(chunks, start=1):
        try:
            cid = uuid.UUID(c.chunk_id)
        except Exception:
            cid = uuid.uuid5(uuid.NAMESPACE_DNS, c.chunk_id)

        try:
            did = uuid.UUID(c.document_id) if c.document_id else uuid.uuid4()
        except Exception:
            did = uuid.uuid5(uuid.NAMESPACE_DNS, c.document_id or c.filename)

        results.append(
            SearchResult(
                chunk_id=cid,
                document_id=did,
                text=c.text,
                score=round(c.score, 4),
                rank=rank_idx,
            )
        )

    latency_ms = (time.perf_counter() - start) * 1000

    return SearchResponse(
        query=payload.query,
        results=results,
        strategy_used=payload.strategy,
        latency_ms=round(latency_ms, 2),
        trace_id=trace_id,
    )

