"""
Log-aware parsing for Titan ingestion.

Plain-text parsing treats a log file as prose, which splits stack traces,
loses timestamps, and produces chunks with no time context. This module:

1. Detects the log format (JSON lines, nginx/apache access, syslog, or any
   generic "timestamp + level" line format).
2. Groups continuation lines (stack traces, wrapped messages) into the entry
   they belong to.
3. Collapses consecutive identical messages ("repeated N times").
4. Packs entries into time-ordered chunks under a word budget, each prefixed
   with a header (file, time window, level counts) so retrieval hits carry
   temporal context.

Chunks are returned as `LogChunk`s that the ingest route stores directly,
bypassing the prose chunker.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field

LOG_EXTENSIONS = {"log", "jsonl", "ndjson"}
MAX_CHUNK_WORDS = 350
MAX_ENTRY_WORDS = 300  # a single huge stack trace is split beyond this

_LEVELS = ("FATAL", "CRITICAL", "ERROR", "WARNING", "WARN", "INFO", "DEBUG", "TRACE")
_LEVEL_NORMALIZE = {"CRITICAL": "FATAL", "WARNING": "WARN"}
_LEVEL_RE = re.compile(r"\b(" + "|".join(_LEVELS) + r")\b", re.IGNORECASE)

_ISO_TS = re.compile(
    r"^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?"
)
_SYSLOG = re.compile(
    r"^([A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s+(\S+)\s+([\w./-]+)(?:\[\d+\])?:\s"
)
_ACCESS = re.compile(
    r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\S+)'
)

_JSON_TS_KEYS = ("@timestamp", "timestamp", "time", "ts", "t", "datetime")
_JSON_LEVEL_KEYS = ("level", "severity", "lvl", "levelname", "log.level")
_JSON_MSG_KEYS = ("message", "msg", "log", "event", "text")


@dataclass
class LogEntry:
    timestamp: str | None
    level: str
    text: str
    repeat: int = 1


@dataclass
class LogChunk:
    text: str
    section: str
    time_start: str | None
    time_end: str | None
    levels: dict[str, int]
    entry_count: int


@dataclass
class LogParseResult:
    log_format: str
    chunks: list[LogChunk]
    total_entries: int
    time_start: str | None
    time_end: str | None
    level_counts: dict[str, int] = field(default_factory=dict)


def _norm_level(raw: str | None) -> str:
    if not raw:
        return "UNKNOWN"
    up = str(raw).upper()
    return _LEVEL_NORMALIZE.get(up, up if up in _LEVELS else "UNKNOWN")


def _status_level(status: str) -> str:
    if status.startswith("5"):
        return "ERROR"
    if status.startswith("4"):
        return "WARN"
    return "INFO"


def detect_format(lines: list[str]) -> str:
    """Vote across the first non-empty lines."""
    votes: Counter[str] = Counter()
    sample = [ln for ln in lines[:200] if ln.strip()][:50]
    for ln in sample:
        s = ln.strip()
        if s.startswith("{") and s.endswith("}"):
            try:
                json.loads(s)
                votes["jsonl"] += 1
                continue
            except ValueError:
                pass
        if _ACCESS.match(s):
            votes["access"] += 1
        elif _SYSLOG.match(s):
            votes["syslog"] += 1
        elif _ISO_TS.match(s):
            votes["iso"] += 1
    if not votes:
        return "unknown"
    fmt, count = votes.most_common(1)[0]
    # Require a meaningful share of sampled lines to look structured.
    return fmt if count >= max(2, len(sample) // 4) else "unknown"


def is_log_file(filename: str, file_bytes: bytes) -> bool:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext in LOG_EXTENSIONS:
        return True
    if ext in ("txt", ""):
        head = file_bytes[:16384].decode("utf-8", errors="replace").splitlines()
        return detect_format(head) != "unknown"
    return False


def _parse_json_line(s: str) -> LogEntry | None:
    try:
        obj = json.loads(s)
    except ValueError:
        return None
    if not isinstance(obj, dict):
        return None
    ts = next((str(obj[k]) for k in _JSON_TS_KEYS if k in obj), None)
    level = next((obj[k] for k in _JSON_LEVEL_KEYS if k in obj), None)
    msg = next((str(obj[k]) for k in _JSON_MSG_KEYS if k in obj), "")
    skip = set(_JSON_TS_KEYS) | set(_JSON_LEVEL_KEYS) | set(_JSON_MSG_KEYS)
    extras = {k: v for k, v in obj.items() if k not in skip}
    text = msg
    if extras:
        text += " " + json.dumps(extras, separators=(",", ":"), default=str)
    return LogEntry(ts, _norm_level(level), text.strip())


def parse_entries(lines: list[str], fmt: str) -> list[LogEntry]:
    entries: list[LogEntry] = []
    current: LogEntry | None = None

    for raw in lines:
        line = raw.rstrip("\r\n")
        if not line.strip():
            continue

        entry: LogEntry | None = None
        if fmt == "jsonl":
            entry = _parse_json_line(line.strip())
        elif fmt == "access":
            m = _ACCESS.match(line)
            if m:
                entry = LogEntry(m.group(2), _status_level(m.group(5)), line.strip())
        elif fmt == "syslog":
            m = _SYSLOG.match(line)
            if m:
                lm = _LEVEL_RE.search(line)
                entry = LogEntry(m.group(1), _norm_level(lm.group(1) if lm else None), line.strip())
        elif fmt == "iso":
            m = _ISO_TS.match(line)
            if m:
                lm = _LEVEL_RE.search(line[m.end():m.end() + 40])
                entry = LogEntry(m.group(1), _norm_level(lm.group(1) if lm else None), line.strip())
        else:  # unknown: every non-empty line is its own entry
            lm = _LEVEL_RE.search(line)
            entry = LogEntry(None, _norm_level(lm.group(1) if lm else None), line.strip())

        if entry is not None:
            entries.append(entry)
            current = entry
        elif current is not None:
            # continuation line (stack trace, wrapped message)
            current.text += "\n" + line.rstrip()
        else:
            current = LogEntry(None, "UNKNOWN", line.strip())
            entries.append(current)

    return _collapse_repeats(entries)


def _signature(e: LogEntry) -> str:
    """Message identity ignoring the leading timestamp."""
    body = e.text
    m = _ISO_TS.match(body)
    if m:
        body = body[m.end():]
    return f"{e.level}|{body.strip()}"


def _collapse_repeats(entries: list[LogEntry]) -> list[LogEntry]:
    out: list[LogEntry] = []
    for e in entries:
        if out and _signature(out[-1]) == _signature(e):
            out[-1].repeat += 1
        else:
            out.append(e)
    return out


def _render(e: LogEntry) -> str:
    return e.text + (f"  (repeated {e.repeat} times)" if e.repeat > 1 else "")


def _split_big(text: str) -> list[str]:
    """Split one oversized entry (giant traceback) on line boundaries,
    repeating its first line so every piece stays identifiable."""
    lines = text.splitlines()
    if len(text.split()) <= MAX_ENTRY_WORDS or len(lines) < 2:
        return [text]
    head, pieces, buf, words = lines[0], [], [], 0
    for ln in lines[1:]:
        w = len(ln.split())
        if words + w > MAX_ENTRY_WORDS and buf:
            pieces.append(head + "\n" + "\n".join(buf))
            buf, words = [], 0
        buf.append(ln)
        words += w
    if buf:
        pieces.append(head + "\n" + "\n".join(buf))
    return pieces


def _make_chunk(filename: str, group: list[LogEntry]) -> LogChunk:
    stamps = [e.timestamp for e in group if e.timestamp]
    t0, t1 = (stamps[0], stamps[-1]) if stamps else (None, None)
    levels: Counter[str] = Counter()
    for e in group:
        levels[e.level] += e.repeat
    window = f"{t0} -> {t1}" if t0 else "no timestamps"
    lvl = ", ".join(f"{k}x{v}" for k, v in levels.most_common())
    header = f"[Log: {filename} | {window} | {len(group)} entries | {lvl}]"
    body = "\n".join(_render(e) for e in group)
    section = f"{t0} - {t1}" if t0 else "Log segment"
    return LogChunk(
        text=f"{header}\n{body}",
        section=section[:250],
        time_start=t0,
        time_end=t1,
        levels=dict(levels),
        entry_count=len(group),
    )


def parse_log(filename: str, file_bytes: bytes) -> LogParseResult | None:
    """Returns None when the file is not recognised as a log."""
    if not is_log_file(filename, file_bytes):
        return None

    lines = file_bytes.decode("utf-8", errors="replace").splitlines()
    fmt = detect_format(lines)
    entries = parse_entries(lines, fmt)
    if not entries:
        return LogParseResult(fmt, [], 0, None, None)

    # Flatten oversized entries into pieces so packing respects the budget.
    packed: list[LogEntry] = []
    for e in entries:
        pieces = _split_big(_render(e))
        if len(pieces) == 1:
            packed.append(e)
        else:
            packed.extend(LogEntry(e.timestamp, e.level, p) for p in pieces)

    chunks: list[LogChunk] = []
    group: list[LogEntry] = []
    words = 0
    for e in packed:
        w = len(_render(e).split())
        if group and words + w > MAX_CHUNK_WORDS:
            chunks.append(_make_chunk(filename, group))
            group, words = [], 0
        group.append(e)
        words += w
    if group:
        chunks.append(_make_chunk(filename, group))

    totals: Counter[str] = Counter()
    for e in entries:
        totals[e.level] += e.repeat
    stamps = [e.timestamp for e in entries if e.timestamp]
    return LogParseResult(
        log_format=fmt,
        chunks=chunks,
        total_entries=sum(e.repeat for e in entries),
        time_start=stamps[0] if stamps else None,
        time_end=stamps[-1] if stamps else None,
        level_counts=dict(totals),
    )
