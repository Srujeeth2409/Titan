from fastapi import APIRouter

from app.schemas.telemetry import Trace

router = APIRouter(prefix="/telemetry", tags=["telemetry"])

_TRACES: dict[str, Trace] = {}


@router.get("/{trace_id}", response_model=Trace)
async def get_trace(trace_id: str) -> Trace:
    trace = _TRACES.get(trace_id)
    if trace is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace
