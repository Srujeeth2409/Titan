"""
Structured JSON logging with correlation IDs.

Every log line is emitted as JSON so it can be shipped straight into the
Observability Platform (Loki / ELK / CloudWatch) and joined against traces
via `trace_id`. Correlation IDs are propagated through the request context
so a single user query can be reconstructed end-to-end across ingestion,
retrieval, reranking, LLM inference, and citation generation.
"""
import contextvars
import json
import logging
import sys
import time

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
