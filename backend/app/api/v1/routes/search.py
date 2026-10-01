import time
import uuid

from fastapi import APIRouter

from app.schemas.query import SearchRequest, SearchResponse, SearchResult

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    start = time.perf_counter()
    # Production: HybridRetriever -> Reranker -> SearchResult list
    results = [
        SearchResult(
            chunk_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            text=f"Placeholder passage relevant to: {payload.query}",
            score=0.91,
            rank=1,
        )
    ]
    return SearchResponse(
        query=payload.query,
        results=results,
        strategy_used=payload.strategy,
        latency_ms=(time.perf_counter() - start) * 1000,
        trace_id=str(uuid.uuid4()),
    )
