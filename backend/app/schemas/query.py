from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class RetrievalStrategy(str, Enum):
    DENSE = "dense"
    SPARSE_BM25 = "sparse_bm25"
    HYBRID = "hybrid"
    MULTI_QUERY = "multi_query"
    GRAPH = "graph"


class SearchRequest(BaseModel):
    query: str
    workspace_id: UUID
    strategy: RetrievalStrategy = RetrievalStrategy.HYBRID
    top_k: int = 20
    rerank: bool = True
    rerank_top_n: int = 6
    filters: dict = Field(default_factory=dict)


class Citation(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_name: str
    page_number: int | None = None
    section: str | None = None
    confidence: float
    passage: str


class SearchResult(BaseModel):
    chunk_id: UUID
    document_id: UUID
    text: str
    score: float
    rank: int


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    strategy_used: RetrievalStrategy
    latency_ms: float
    trace_id: str


class ChatRequest(BaseModel):
    message: str
    workspace_id: UUID
    conversation_id: UUID | None = None
    strategy: RetrievalStrategy = RetrievalStrategy.HYBRID


class ChatResponse(BaseModel):
    conversation_id: UUID = Field(default_factory=uuid4)
    answer: str
    citations: list[Citation]
    hallucination_score: float
    faithfulness_score: float
    latency_ms: float
    tokens_used: int
    trace_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
