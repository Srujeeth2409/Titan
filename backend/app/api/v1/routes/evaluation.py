from uuid import UUID

from fastapi import APIRouter

from app.schemas.telemetry import EvaluationResult

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

_RESULTS: list[EvaluationResult] = []


@router.get("", response_model=list[EvaluationResult])
async def list_results(experiment_id: UUID | None = None) -> list[EvaluationResult]:
    if experiment_id is None:
        return _RESULTS
    return [r for r in _RESULTS if r.experiment_id == experiment_id]
