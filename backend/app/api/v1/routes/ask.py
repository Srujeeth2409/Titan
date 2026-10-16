"""
Ask endpoints for Titan — Non-streaming and Server-Sent Events (SSE) streaming.

Connects to:
- FastEmbed / OpenAI for query embedding
- Qdrant for semantic vector search across document collections
- LLM Gateway (Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o / Ollama / Qwen) for generation
- Real citation grounding and confidence computation
"""
import json
import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser
from app.schemas.ask import AskRequest
from app.services.citation.service import get_citation_engine
from app.services.embedding.service import get_embedding_provider
from app.services.hallucination.service import get_hallucination_detector
from app.services.llm_gateway.service import get_llm_gateway
from app.services.retrieval.service import RetrievedChunk, get_retrieval_service

router = APIRouter(tags=["ask"])


SYSTEM_PROMPT = """You are Titan, an enterprise document intelligence platform.
Your mission is to provide truthful, verified, and grounded answers using ONLY the supplied reference passages.

Rules:
1. Ground your answer strictly on the provided Context passages.
2. When referencing facts from a passage, include an inline citation formatted as [1], [2], etc., matching the passage index.
3. If the provided context does not contain enough information to answer the question faithfully, state clearly what is missing rather than inventing facts.
4. Keep the tone concise, authoritative, and professional.
"""


def _build_context_prompt(question: str, chunks: List[RetrievedChunk]) -> str:
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
    return (
        f"Context Passages:\n{context_str}\n\n"
        f"User Question: {question}\n\n"
        f"Please provide a grounded answer with inline citations [1], [2], etc.:"
    )


def _calculate_confidence(chunks: List[RetrievedChunk], citations: List[dict], hallucination_score: float = 0.0):
    if not chunks:
        return {"composite": 0.0, "retrieval": 0.0, "citation_coverage": 0.0, "completeness": 0.0, "hallucination_risk": 1.0}

    avg_score = sum(c.score for c in chunks) / len(chunks)
    retrieval_conf = min(max(avg_score, 0.0), 1.0)
    citation_coverage = min(len(citations) / max(len(chunks), 1), 1.0) if citations else 0.5
    grounding_factor = max(0.0, 1.0 - hallucination_score)
    completeness = 0.9 if citations else 0.4
    composite = round(
        (retrieval_conf * 0.35) + (citation_coverage * 0.35) + (grounding_factor * 0.20) + (completeness * 0.10),
        2,
    )

    return {
        "composite": composite,
        "retrieval": round(retrieval_conf, 2),
        "citation_coverage": round(citation_coverage, 2),
        "completeness": round(completeness, 2),
        "hallucination_risk": round(hallucination_score, 2),
    }


@router.post("/ask")
async def ask(
    body: AskRequest,
    user: CurrentUser,
) -> dict:
    """
    Non-streaming ask endpoint.
    Executes hybrid retrieval (Dense + BM25 + RRF + Reranker),
    generates grounded answer, computes sentence citations and runs hallucination check.
    """
    run_id = str(uuid.uuid4())
    trace_id = f"tt-{uuid.uuid4().hex[:16]}"
    start_time = time.perf_counter()

    try:
        # 1. Embed query
        embedder = get_embedding_provider()
        query_vectors = await embedder.embed([body.question])
        query_vector = query_vectors[0]

        # 2. Hybrid Search (Qdrant Dense + BM25 Sparse + RRF + Reranker)
        retriever = get_retrieval_service()
        top_m = (body.options.top_m if body.options and body.options.top_m else 6)
        chunks = await retriever.hybrid_search(
            collection_name=body.collection,
            query=body.question,
            query_vector=query_vector,
            top_k=top_m,
            rerank=True,
        )

        # 3. Check for abstention
        if not chunks or (len(chunks) > 0 and chunks[0].score < 0.25):
            return {
                "run_id": run_id,
                "trace_id": trace_id,
                "status": "abstained",
                "abstention": {
                    "found": [c.filename for c in chunks],
                    "missing": f"No passages with sufficient semantic confidence found in collection '{body.collection}'.",
                    "suggested_documents": ["Upload relevant domain documents to this collection."],
                },
                "confidence": {"composite": 0.0, "retrieval": round(chunks[0].score if chunks else 0.0, 2)},
            }

        # 4. Generate answer
        user_prompt = _build_context_prompt(body.question, chunks)
        llm = get_llm_gateway()
        llm_response = await llm.generate(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            provider=body.provider,
            model=body.model,
        )

        # 5. Citation Grounding & Hallucination Detection
        citation_engine = get_citation_engine()
        citations = citation_engine.build_citations(llm_response.text, chunks)

        hallucination_detector = get_hallucination_detector()
        hall_report = await hallucination_detector.check(
            answer=llm_response.text,
            context_chunks=[c.text for c in chunks],
        )

        confidence = _calculate_confidence(chunks, citations, hall_report.score)
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        degraded = ["hallucination_warning"] if hall_report.score > 0.5 else []

        return {
            "run_id": run_id,
            "trace_id": trace_id,
            "status": "answered" if not degraded else "degraded",
            "answer": llm_response.text,
            "citations": citations,
            "confidence": confidence,
            "hallucination": {
                "score": hall_report.score,
                "unsupported_claims": hall_report.unsupported_claims,
                "contradictions": hall_report.contradictions,
                "total_claims": hall_report.total_claims,
            },
            "mode_used": body.mode,
            "steps": 4,
            "degraded": degraded,
            "verified": hall_report.score <= 0.3,
            "usage": {
                "latency_ms": latency_ms,
                "tokens_in": len(user_prompt.split()),
                "tokens_out": len(llm_response.text.split()),
                "cost_usd": 0.0,
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "TT-5000", "message": f"Query processing failed: {str(e)}", "trace_id": trace_id},
        )


@router.post("/ask/stream")
async def ask_stream(
    body: AskRequest,
    user: CurrentUser,
) -> StreamingResponse:
    """
    SSE streaming ask endpoint.
    Streams step progression and real token deltas.
    """
    run_id = str(uuid.uuid4())
    trace_id = f"tt-{uuid.uuid4().hex[:16]}"
    start_time = time.perf_counter()

    async def _event_stream():
        try:
            # Event 1: run_started
            yield f"data: {json.dumps({'type': 'run_started', 'data': {'run_id': run_id, 'trace_id': trace_id}})}\n\n"

            # Event 2: step_started (embedding)
            yield f"data: {json.dumps({'type': 'step_started', 'data': {'step': 'Embedding query with FastEmbed BGE'}})}\n\n"
            embedder = get_embedding_provider()
            query_vectors = await embedder.embed([body.question])
            query_vector = query_vectors[0]
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': 'Embedding query with FastEmbed BGE'}})}\n\n"

            # Event 3: step_started (Hybrid search)
            search_step_msg = f"Hybrid retrieval on '{body.collection}' (Dense Vector + BM25 Sparse + RRF)"
            yield f"data: {json.dumps({'type': 'step_started', 'data': {'step': search_step_msg}})}\n\n"
            retriever = get_retrieval_service()
            top_m = (body.options.top_m if body.options and body.options.top_m else 6)
            chunks = await retriever.hybrid_search(
                collection_name=body.collection,
                query=body.question,
                query_vector=query_vector,
                top_k=top_m,
                rerank=True,
            )
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': f'Fused & reranked {len(chunks)} relevant chunks'}})}\n\n"

            # Event 4: chunks_retrieved
            chunks_summary = [
                {"chunk_id": c.chunk_id, "filename": c.filename, "score": c.score, "section": c.section, "page": c.page_number}
                for c in chunks
            ]
            yield f"data: {json.dumps({'type': 'chunks_retrieved', 'data': {'count': len(chunks), 'chunks': chunks_summary}})}\n\n"

            # Check for abstention if no chunks or low confidence
            if not chunks or (chunks and chunks[0].score < 0.25):
                abstention_data = {
                    "run_id": run_id,
                    "trace_id": trace_id,
                    "status": "abstained",
                    "abstention": {
                        "found": [c.filename for c in chunks],
                        "missing": f"No documents in collection '{body.collection}' contain sufficient information to answer this question.",
                        "suggested_documents": ["Please upload the relevant reference files via the Documents page."],
                    },
                    "confidence": {"composite": 0.0, "retrieval": round(chunks[0].score if chunks else 0.0, 2)},
                }
                yield f"data: {json.dumps({'type': 'answer_final', 'data': abstention_data})}\n\n"
                return

            # Event 5: step_started (generation)
            yield f"data: {json.dumps({'type': 'step_started', 'data': {'step': 'Synthesizing verified answer with LLM'}})}\n\n"
            user_prompt = _build_context_prompt(body.question, chunks)
            llm = get_llm_gateway()

            answer_tokens = []
            async for token in llm.stream_generate(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                provider=body.provider,
                model=body.model,
            ):
                answer_tokens.append(token)
                yield f"data: {json.dumps({'type': 'token', 'data': {'token': token}})}\n\n"

            full_answer = "".join(answer_tokens)
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': 'Answer synthesis complete'}})}\n\n"

            # Event 6: step_started (grounding & hallucination check)
            yield f"data: {json.dumps({'type': 'step_started', 'data': {'step': 'Verifying sentence citations and hallucination check'}})}\n\n"
            citation_engine = get_citation_engine()
            citations = citation_engine.build_citations(full_answer, chunks)

            hallucination_detector = get_hallucination_detector()
            hall_report = await hallucination_detector.check(
                answer=full_answer,
                context_chunks=[c.text for c in chunks],
            )
            confidence = _calculate_confidence(chunks, citations, hall_report.score)
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': 'Verification and grounding complete'}})}\n\n"

            latency_ms = int((time.perf_counter() - start_time) * 1000)
            degraded = ["hallucination_warning"] if hall_report.score > 0.5 else []

            final_payload = {
                "run_id": run_id,
                "trace_id": trace_id,
                "status": "answered" if not degraded else "degraded",
                "answer": full_answer,
                "citations": citations,
                "confidence": confidence,
                "hallucination": {
                    "score": hall_report.score,
                    "unsupported_claims": hall_report.unsupported_claims,
                    "contradictions": hall_report.contradictions,
                    "total_claims": hall_report.total_claims,
                },
                "mode_used": body.mode,
                "steps": 4,
                "degraded": degraded,
                "verified": hall_report.score <= 0.3,
                "usage": {"latency_ms": latency_ms},
            }
            yield f"data: {json.dumps({'type': 'answer_final', 'data': final_payload})}\n\n"

        except Exception as e:
            err_payload = {
                "type": "error",
                "data": {
                    "code": "TT-5002",
                    "message": str(e),
                    "trace_id": trace_id,
                },
            }
            yield f"data: {json.dumps(err_payload)}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Trace-Id": trace_id,
        },
    )
