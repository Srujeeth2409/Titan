import json

from app.services.ingestion.log_parser import detect_format, is_log_file, parse_log

ISO = (
    "2026-10-03 10:00:01,123 INFO  api  request ok\n"
    "2026-10-03 10:00:02,200 ERROR api  Unhandled exception\n"
    "Traceback (most recent call last):\n"
    '  File "app.py", line 10, in handler\n'
    "ValueError: boom\n"
    "2026-10-03 10:00:03,000 WARN  api  slow query\n"
    "2026-10-03 10:00:04,000 WARN  api  slow query\n"
    "2026-10-03 10:00:05,000 WARN  api  slow query\n"
)


def test_iso_multiline_and_repeat_collapse():
    r = parse_log("app.log", ISO.encode())
    assert r.log_format == "iso"
    text = "\n".join(c.text for c in r.chunks)
    assert "ValueError: boom" in text and "Traceback" in text  # trace stays attached
    assert r.level_counts["ERROR"] == 1
    assert r.level_counts["WARN"] == 3
    assert "repeated 3 times" in text
    assert r.time_start.startswith("2026-10-03 10:00:01")


def test_jsonl():
    lines = [json.dumps({"ts": f"2026-10-03T10:00:0{i}Z", "level": "error" if i == 2 else "info",
                         "msg": f"event {i}", "user": i}) for i in range(5)]
    r = parse_log("x.jsonl", "\n".join(lines).encode())
    assert r.log_format == "jsonl"
    assert r.level_counts == {"INFO": 4, "ERROR": 1}
    assert '"user":2' in r.chunks[0].text


def test_access_log_status_levels():
    ln = '1.2.3.4 - - [03/Oct/2026:10:00:00 +0000] "GET /a HTTP/1.1" 500 12 "-" "curl"\n'
    ln2 = '1.2.3.4 - - [03/Oct/2026:10:00:01 +0000] "GET /b HTTP/1.1" 404 12 "-" "curl"\n'
    r = parse_log("access.log", (ln + ln2 * 3).encode())
    assert r.log_format == "access"
    assert r.level_counts["ERROR"] == 1 and r.level_counts["WARN"] == 3


def test_syslog_detect():
    s = "Oct  3 10:00:01 host sshd[123]: Failed password for root\n" * 4
    assert detect_format(s.splitlines()) == "syslog"


def test_chunk_budget_and_header():
    big = "".join(f"2026-10-03 10:{i//60:02d}:{i%60:02d} INFO svc message number {i} with padding words here\n"
                  for i in range(400))
    r = parse_log("big.log", big.encode())
    assert len(r.chunks) > 3
    assert all(c.text.startswith("[Log: big.log") for c in r.chunks)
    assert all(len(c.text.split()) < 450 for c in r.chunks)


def test_non_log_text_not_detected():
    assert not is_log_file("notes.txt", b"Just a paragraph of prose.\nAnother line.\n")
    assert not is_log_file("report.pdf", b"%PDF")
    assert parse_log("notes.txt", b"hello world") is None
