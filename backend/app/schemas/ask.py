"""
Pydantic schemas for /v1/ask and /v1/ask/stream endpoints.
Matches Build Brief Section 7.2 / 7.3 exactly.
"""
from pydantic import BaseModel, Field


class AskFilters(BaseModel):
    source: str | None = None


class AskOptions(BaseModel):
    top_m: int = 6
    return_chunks: bool = True


class AskRequest(BaseModel):
    question: str
    collection: str = "default"
    mode: str = Field(default="auto", pattern="^(auto|single|agentic)$")
    filters: AskFilters = AskFilters()
    options: AskOptions = AskOptions()


class Citation(BaseModel):
    index: int
    chunk_id: str
    source: str
    section: str
    page: int
    verdict: str


class Confidence(BaseModel):
    composite: float = 0.0
    retrieval: float = 0.0
    citation_coverage: float = 0.0
    completeness: float = 0.0


class Usage(BaseModel):
    latency_ms: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0


class AskResponseAnswered(BaseModel):
    run_id: str
    trace_id: str
    status: str = "answered"
    answer: str
    citations: list[Citation] = []
    confidence: Confidence = Confidence()
    mode_used: str = "auto"
    steps: int = 0
    degraded: list[str] = []
    verified: bool = True
    usage: Usage = Usage()


class Abstention(BaseModel):
    found: list[str] = []
    missing: str = ""
    suggested_documents: list[str] = []


class AskResponseAbstained(BaseModel):
    run_id: str
    trace_id: str
    status: str = "abstained"
    abstention: Abstention = Abstention()
    confidence: Confidence = Confidence()


class ErrorDetail(BaseModel):
    code: str
    message: str
    trace_id: str = ""


class ErrorResponse(BaseModel):
    error: ErrorDetail
