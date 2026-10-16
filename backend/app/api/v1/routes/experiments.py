from uuid import UUID, uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/experiments", tags=["experiments"])


class ExperimentConfig(BaseModel):
    name: str
    embedding_model: str
    chunk_strategy: str
    retrieval_strategy: str
    reranker: str
    llm_model: str


class Experiment(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    config: ExperimentConfig
    status: str = "pending"


_EXPERIMENTS: dict[UUID, Experiment] = {}


@router.post("", response_model=Experiment)
async def create_experiment(config: ExperimentConfig) -> Experiment:
    exp = Experiment(config=config)
    _EXPERIMENTS[exp.id] = exp
    # Production: enqueue benchmark run against the labeled eval set,
    # write per-query metrics, surface on the leaderboard
    return exp


@router.get("", response_model=list[Experiment])
async def list_experiments() -> list[Experiment]:
    return list(_EXPERIMENTS.values())
