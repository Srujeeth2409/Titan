import time
import uuid

from fastapi import APIRouter

from app.schemas.query import ChatRequest, ChatResponse, Citation, RetrievalStrategy
from app.services.citation.service import get_citation_engine
from app.services.embedding.service import get_embedding_provider
from app.services.hallucination.service import get_hallucination_detector
from app.services.llm_gateway.service import get_llm_gateway
from app.services.retrieval.service import get_retrieval_service

router = APIRouter(prefix="/chat", tags=["chat"])

CHAT_SYSTEM_PROMPT = """You are Titan, an enterprise document intelligence assistant.
Answer the user prompt accurately, truthfully, and authoritatively based ONLY on the provided context passages.
Cite your sources with [1], [2], etc., matching the passage index.
"""


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    start = time.perf_counter()
    trace_id = str(uuid.uuid4())
    conv_id = payload.conversation_id or uuid.uuid4()
    collection_name = str(payload.workspace_id) if payload.workspace_id else "default"

    # 1. Embed message
    embedder = get_embedding_provider()
    query_vectors = await embedder.embed([payload.message])
    query_vector = query_vectors[0]

    # 2. Hybrid Retrieval
    retriever = get_retrieval_service()
    if payload.strategy == RetrievalStrategy.DENSE:
        chunks = await retriever.search(
            collection_name=collection_name,
            query_vector=query_vector,
            top_k=6,
        )
    else:
        chunks = await retriever.hybrid_search(
            collection_name=collection_name,
            query=payload.message,
            query_vector=query_vector,
            top_k=6,
            rerank=True,
        )

    # 3. Assemble context prompt
    passages = []
    for idx, c in enumerate(chunks, start=1):
        passages.append(
            f"--- PASSAGE [{idx}] ---\n"
            f"Source Document: {c.filename}\n"
            f"Section: {c.section or 'General'}\n"
            f"Page: {c.page_number or 'N/A'}\n"
            f"Content: {c.text}\n"
        )
    context_str = "\n".join(passages)
    user_prompt = (
        f"Context Passages:\n{context_str}\n\n"
        f"User Message: {payload.message}\n\n"
        f"Grounded response with inline citations:"
    )

    # 4. LLM Generation
    llm = get_llm_gateway()
    llm_resp = await llm.generate(
        system_prompt=CHAT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )
    answer_text = llm_resp.text

    # 5. Citations & Hallucination check
    citation_engine = get_citation_engine()
    raw_citations = citation_engine.build_citations(answer_text, chunks)

    hall_detector = get_hallucination_detector()
    hall_report = await hall_detector.check(
        answer=answer_text,
        context_chunks=[c.text for c in chunks],
    )

    citations: list[Citation] = []
    for rc in raw_citations:
        try:
            cid = uuid.UUID(rc.get("chunk_id", ""))
        except Exception:
            cid = uuid.uuid5(uuid.NAMESPACE_DNS, str(rc.get("chunk_id", "")))

        citations.append(
            Citation(
                chunk_id=cid,
                document_id=uuid.uuid5(uuid.NAMESPACE_DNS, rc.get("source", "doc")),
                document_name=rc.get("source", "document"),
                page_number=rc.get("page"),
                section=rc.get("section"),
                confidence=rc.get("confidence", 0.8),
                passage=rc.get("snippet", ""),
            )
        )

    tokens_used = len(user_prompt.split()) + len(answer_text.split())
    latency_ms = (time.perf_counter() - start) * 1000

    return ChatResponse(
        conversation_id=conv_id,
        answer=answer_text,
        citations=citations,
        hallucination_score=hall_report.score,
        faithfulness_score=round(max(0.0, 1.0 - hall_report.score), 2),
        latency_ms=round(latency_ms, 2),
        tokens_used=tokens_used,
        trace_id=trace_id,
    )

