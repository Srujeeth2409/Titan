#!/usr/bin/env python3
"""
Push log lines to Titan's log ingestion API.

Usage:
  export LOG_INGEST_API_KEY=dev-log-ingest-key-change-me
  echo '{"level":"INFO","message":"hello","source":"demo"}' | python scripts/log_shipper.py
  python scripts/log_shipper.py --file access.log --source nginx --service edge
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import httpx

DEFAULT_API = "http://localhost:8000/v1/logs/ingest/batch"


def parse_line(line: str, source: str, service: str | None, environment: str | None) -> dict:
    line = line.strip()
    if not line:
        raise ValueError("empty line")
    try:
        obj = json.loads(line)
        if "message" not in obj:
            raise ValueError("JSON line must include message")
        obj.setdefault("source", source)
        if service:
            obj.setdefault("service", service)
        if environment:
            obj.setdefault("environment", environment)
        return obj
    except json.JSONDecodeError:
        return {
            "source": source,
            "service": service,
            "environment": environment,
            "level": "INFO",
            "message": line,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Ship logs to Titan")
    parser.add_argument("--api", default=os.environ.get("TITAN_LOG_INGEST_URL", DEFAULT_API))
    parser.add_argument("--key", default=os.environ.get("LOG_INGEST_API_KEY", ""))
    parser.add_argument("--source", default="shipper", help="Default source label")
    parser.add_argument("--service", default=None)
    parser.add_argument("--environment", default=os.environ.get("ENVIRONMENT"))
    parser.add_argument("--file", "-f", type=argparse.FileType("r"), default=None)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()

    if not args.key:
        print("LOG_INGEST_API_KEY is required", file=sys.stderr)
        return 1

    stream = args.file if args.file else sys.stdin
    batch: list[dict] = []
    headers = {"X-Log-Ingest-Key": args.key, "Content-Type": "application/json"}

    with httpx.Client(timeout=30.0) as client:
        for line in stream:
            if not line.strip():
                continue
            try:
                batch.append(
                    parse_line(line, args.source, args.service, args.environment)
                )
            except ValueError:
                continue
            if len(batch) >= args.batch_size:
                resp = client.post(args.api, headers=headers, json={"events": batch})
                resp.raise_for_status()
                batch.clear()

        if batch:
            resp = client.post(args.api, headers=headers, json={"events": batch})
            resp.raise_for_status()

    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
