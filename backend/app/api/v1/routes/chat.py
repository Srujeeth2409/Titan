import time
import uuid

from fastapi import APIRouter

from app.schemas.query import ChatRequest, ChatResponse, Citation

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    start = time.perf_counter()
    # Production: retrieve -> rerank -> prompt assembly -> LLM Gateway ->
    # citation engine -> hallucination detector -> persist trace
    citations = [
        Citation(
            chunk_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            document_name="example.pdf",
            page_number=4,
            section="Introduction",
            confidence=0.88,
            passage="Supporting passage would appear here.",
        )
    ]
    return ChatResponse(
        conversation_id=payload.conversation_id or uuid.uuid4(),
        answer=f"Placeholder grounded answer for: {payload.message}",
        citations=citations,
        hallucination_score=0.04,
        faithfulness_score=0.95,
        latency_ms=(time.perf_counter() - start) * 1000,
        tokens_used=512,
        trace_id=str(uuid.uuid4()),
    )
