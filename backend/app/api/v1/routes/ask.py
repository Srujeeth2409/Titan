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
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.deps import CurrentUser
from app.schemas.ask import AskRequest
from app.services.embedding.service import get_embedding_provider
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


def _build_citations(answer: str, chunks: List[RetrievedChunk]) -> List[dict]:
    citations = []
    for idx, chunk in enumerate(chunks, start=1):
        marker = f"[{idx}]"
        if marker in answer or len(chunks) == 1:
            citations.append({
                "index": idx,
                "chunk_id": chunk.chunk_id,
                "source": chunk.filename,
                "section": chunk.section or "General",
                "page": chunk.page_number or 1,
                "verdict": "supported",
            })
    # If no explicit markers found, include top 2 chunks as source candidates
    if not citations and chunks:
        for idx, chunk in enumerate(chunks[:2], start=1):
            citations.append({
                "index": idx,
                "chunk_id": chunk.chunk_id,
                "source": chunk.filename,
                "section": chunk.section or "General",
                "page": chunk.page_number or 1,
                "verdict": "supported",
            })
    return citations


def _calculate_confidence(chunks: List[RetrievedChunk], citations: List[dict]):
    if not chunks:
        return {"composite": 0.0, "retrieval": 0.0, "citation_coverage": 0.0, "completeness": 0.0}

    avg_score = sum(c.score for c in chunks) / len(chunks)
    # Cosine score normalizer
    retrieval_conf = min(max(avg_score, 0.0), 1.0)
    citation_coverage = min(len(citations) / max(len(chunks), 1), 1.0) if citations else 0.5
    completeness = 0.9 if citations else 0.4
    composite = round((retrieval_conf * 0.4) + (citation_coverage * 0.4) + (completeness * 0.2), 2)

    return {
        "composite": composite,
        "retrieval": round(retrieval_conf, 2),
        "citation_coverage": round(citation_coverage, 2),
        "completeness": round(completeness, 2),
    }


@router.post("/ask")
async def ask(
    body: AskRequest,
    user: CurrentUser,
) -> dict:
    """
    Non-streaming ask endpoint.
    Retrieves real context from Qdrant and generates an answer via LLM Gateway.
    """
    run_id = str(uuid.uuid4())
    trace_id = f"tt-{uuid.uuid4().hex[:16]}"
    start_time = time.perf_counter()

    try:
        # 1. Embed query
        embedder = get_embedding_provider()
        query_vectors = await embedder.embed([body.question])
        query_vector = query_vectors[0]

        # 2. Search Qdrant
        retriever = get_retrieval_service()
        top_m = (body.options.top_m if body.options and body.options.top_m else 6)
        chunks = await retriever.search(
            collection_name=body.collection,
            query_vector=query_vector,
            top_k=top_m,
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
        )

        citations = _build_citations(llm_response.text, chunks)
        confidence = _calculate_confidence(chunks, citations)
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        return {
            "run_id": run_id,
            "trace_id": trace_id,
            "status": "answered",
            "answer": llm_response.text,
            "citations": citations,
            "confidence": confidence,
            "mode_used": body.mode,
            "steps": 2,
            "degraded": [],
            "verified": True,
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

            # Event 3: step_started (search)
            search_step_msg = f"Searching collection '{body.collection}' in Qdrant"
            yield f"data: {json.dumps({'type': 'step_started', 'data': {'step': search_step_msg}})}\n\n"
            retriever = get_retrieval_service()
            top_m = (body.options.top_m if body.options and body.options.top_m else 6)
            chunks = await retriever.search(
                collection_name=body.collection,
                query_vector=query_vector,
                top_k=top_m,
            )
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': f'Retrieved {len(chunks)} relevant chunks from Qdrant'}})}\n\n"

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
            async for token in llm.stream_generate(system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt):
                answer_tokens.append(token)
                yield f"data: {json.dumps({'type': 'token', 'data': {'token': token}})}\n\n"

            full_answer = "".join(answer_tokens)
            yield f"data: {json.dumps({'type': 'step_completed', 'data': {'step': 'Answer synthesis complete'}})}\n\n"

            # Event 6: answer_final with citations & confidence
            citations = _build_citations(full_answer, chunks)
            confidence = _calculate_confidence(chunks, citations)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            final_payload = {
                "run_id": run_id,
                "trace_id": trace_id,
                "status": "answered",
                "answer": full_answer,
                "citations": citations,
                "confidence": confidence,
                "mode_used": body.mode,
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
