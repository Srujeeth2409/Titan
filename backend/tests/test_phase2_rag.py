"""
Unit tests for Titan Phase 2:
- Chunking strategies (recursive, sliding-window, section-aware, semantic)
- BM25 sparse search and index
- Reciprocal rank fusion (RRF) logic
- CitationEngine sentence-level grounding
- HallucinationDetector claim extraction and scoring
"""
import pytest
from app.services.chunking.service import (
    RecursiveChunking,
    SlidingWindowChunking,
    SectionAwareChunking,
    ChunkingService,
    STRATEGY_REGISTRY,
)
from app.services.retrieval.bm25 import BM25Index, BM25Manager
from app.services.citation.service import CitationEngine
from app.services.hallucination.service import HallucinationDetector


def test_recursive_chunking():
    text = (
        "Paragraph 1 contains some text. It explains the first point.\n\n"
        "Paragraph 2 discusses another aspect of the system.\n\n"
        "Paragraph 3 finishes the document with final conclusions."
    )
    chunker = RecursiveChunking(max_tokens=15, overlap_tokens=3)
    chunks = chunker.split(text)
    assert len(chunks) >= 2
    assert all(c.text for c in chunks)
    assert chunks[0].chunk_index == 0


def test_sliding_window_chunking():
    words = "word " * 50
    chunker = SlidingWindowChunking(window_size=20, overlap=5)
    chunks = chunker.split(words)
    assert len(chunks) >= 3
    assert chunks[0].chunk_index == 0
    assert chunks[1].chunk_index == 1


def test_section_aware_chunking():
    markdown = (
        "# Introduction\n"
        "Welcome to Titan document platform.\n\n"
        "## Architecture\n"
        "Titan uses Qdrant, Postgres, and Ollama.\n\n"
        "## Security\n"
        "All data is encrypted in transit and at rest."
    )
    chunker = SectionAwareChunking(max_tokens=50, overlap_tokens=10)
    chunks = chunker.split(markdown)
    assert len(chunks) >= 3
    sections = [c.section for c in chunks]
    assert any("Architecture" in s for s in sections)
    assert any("Security" in s for s in sections)


def test_chunking_service_registry():
    for name in ("recursive", "sliding_window", "section_aware", "semantic"):
        assert name in STRATEGY_REGISTRY
        service = ChunkingService(strategy=name)
        assert service.strategy is not None


def test_bm25_index():
    chunks = [
        {"id": "c1", "text": "PostgreSQL database stores relational document metadata."},
        {"id": "c2", "text": "Qdrant vector engine stores dense chunk embeddings for semantic search."},
        {"id": "c3", "text": "Redis coordinates Celery tasks and caches session tokens."},
    ]
    index = BM25Index()
    index.index_chunks(chunks)

    # Search for vector keyword
    hits = index.search("vector embeddings semantic", top_k=2)
    assert len(hits) > 0
    top_hit_payload, score = hits[0]
    assert top_hit_payload["id"] == "c2"
    assert score > 0.0

    # Search for postgres
    hits_pg = index.search("database metadata", top_k=1)
    assert len(hits_pg) > 0
    assert hits_pg[0][0]["id"] == "c1"


def test_citation_engine_grounding():
    class DummyChunk:
        def __init__(self, cid, fn, text, score=0.9):
            self.chunk_id = cid
            self.filename = fn
            self.text = text
            self.score = score
            self.section = "Overview"
            self.page_number = 1

    chunks = [
        DummyChunk("c1", "titan.pdf", "Titan supports hybrid retrieval combining dense vector search and BM25."),
        DummyChunk("c2", "titan.pdf", "The login page features a sleek dark mode poster with Orbit-style styling."),
    ]

    engine = CitationEngine()

    # 1. Test explicit bracket citation [1]
    answer_with_brackets = "Titan uses hybrid retrieval combining dense search with BM25 [1]."
    citations = engine.build_citations(answer_with_brackets, chunks)
    assert len(citations) >= 1
    assert citations[0]["index"] == 1
    assert citations[0]["verdict"] == "supported"

    # 2. Test sentence token overlap without explicit brackets
    answer_overlap = "The login interface features an Orbit-style dark mode poster aesthetic."
    citations_overlap = engine.build_citations(answer_overlap, chunks)
    assert len(citations_overlap) >= 1
    assert citations_overlap[0]["index"] == 2


def test_hallucination_detector_lexical_fallback():
    import asyncio

    async def _test():
        detector = HallucinationDetector()
        claims = detector.extract_claims(
            "Titan is an enterprise document search platform. It uses Qdrant for vector storage. Bananas are yellow fruits."
        )
        assert len(claims) >= 3

        context = [
            "Titan is an enterprise document search platform with high precision retrieval.",
            "Qdrant is used for vector storage and semantic chunk indexing.",
        ]

        report = await detector.check(
            answer="Titan is an enterprise document search platform. It uses Qdrant for vector storage.",
            context_chunks=context,
        )
        assert report.score <= 0.1
        assert len(report.supported_claims) >= 1

        unsupported_report = await detector.check(
            answer="Mars has colonies populated by flying cars and purple elephants.",
            context_chunks=context,
        )
        assert unsupported_report.score >= 0.8
        assert len(unsupported_report.unsupported_claims) >= 1

    asyncio.run(_test())
