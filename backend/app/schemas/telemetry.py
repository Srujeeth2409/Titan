from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class PipelineStage(str, Enum):
    INGESTION = "ingestion"
    OCR = "ocr"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    VECTOR_SEARCH = "vector_search"
    SPARSE_SEARCH = "sparse_search"
    HYBRID_MERGE = "hybrid_merge"
    RERANKING = "reranking"
    PROMPT_ASSEMBLY = "prompt_assembly"
    LLM_INFERENCE = "llm_inference"
    CITATION = "citation"
    HALLUCINATION_CHECK = "hallucination_check"
    EVALUATION = "evaluation"


class StageEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    trace_id: str
    stage: PipelineStage
    started_at: datetime
    duration_ms: float
    success: bool
    metadata: dict = Field(default_factory=dict)
    error: str | None = None


class Trace(BaseModel):
    trace_id: str
    workspace_id: UUID
    query: str
    stages: list[StageEvent]
    total_latency_ms: float
    total_tokens: int
    total_cost_usd: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EvaluationMetricType(str, Enum):
    RECALL_AT_K = "recall_at_k"
    PRECISION_AT_K = "precision_at_k"
    MRR = "mrr"
    NDCG = "ndcg"
    FAITHFULNESS = "faithfulness"
    GROUNDEDNESS = "groundedness"
    RELEVANCE = "relevance"
    CORRECTNESS = "correctness"


class EvaluationResult(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    experiment_id: UUID | None = None
    trace_id: str
    metric: EvaluationMetricType
    value: float
    created_at: datetime = Field(default_factory=datetime.utcnow)
