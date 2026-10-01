"""
Document Parsers for Titan Ingestion.

Supports all popular document formats:
- PDF (.pdf) via pypdf
- Word Documents (.docx) via python-docx
- Markdown (.md, .markdown)
- Plain Text (.txt)
- CSV (.csv)
- JSON (.json)
"""
import csv
import io
import json
from dataclasses import dataclass
from typing import List, Tuple

import pypdf
import docx


@dataclass
class ParsedSection:
    text: str
    page_number: int | None = None
    section: str | None = None


def parse_document(filename: str, file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    """
    Parses a document into full text and structured sections with page/heading metadata.
    """
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext == "pdf":
        return _parse_pdf(file_bytes)
    elif ext == "docx":
        return _parse_docx(file_bytes)
    elif ext in ("md", "markdown"):
        return _parse_markdown(file_bytes)
    elif ext == "csv":
        return _parse_csv(file_bytes)
    elif ext == "json":
        return _parse_json(file_bytes)
    else:
        # Default to plain text
        return _parse_txt(file_bytes)


def _parse_pdf(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    sections: List[ParsedSection] = []
    full_text_parts: List[str] = []

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            full_text_parts.append(text)
            sections.append(ParsedSection(text=text, page_number=page_num, section=f"Page {page_num}"))

    return "\n\n".join(full_text_parts), sections


def _parse_docx(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    doc = docx.Document(io.BytesIO(file_bytes))
    sections: List[ParsedSection] = []
    full_text_parts: List[str] = []
    current_section = "Main"
    current_section_texts: List[str] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        if para.style and para.style.name and para.style.name.startswith("Heading"):
            if current_section_texts:
                sec_text = "\n".join(current_section_texts)
                sections.append(ParsedSection(text=sec_text, section=current_section))
                current_section_texts = []
            current_section = text
        else:
            current_section_texts.append(text)
            full_text_parts.append(text)

    if current_section_texts:
        sec_text = "\n".join(current_section_texts)
        sections.append(ParsedSection(text=sec_text, section=current_section))

    return "\n\n".join(full_text_parts), sections


def _parse_markdown(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    text = file_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()
    sections: List[ParsedSection] = []
    current_section = "Introduction"
    current_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            if current_lines:
                sec_text = "\n".join(current_lines).strip()
                if sec_text:
                    sections.append(ParsedSection(text=sec_text, section=current_section))
                current_lines = []
            current_section = stripped.lstrip("#").strip()
        else:
            current_lines.append(line)

    if current_lines:
        sec_text = "\n".join(current_lines).strip()
        if sec_text:
            sections.append(ParsedSection(text=sec_text, section=current_section))

    return text, sections


def _parse_csv(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return "", []

    headers = rows[0]
    sections: List[ParsedSection] = []
    full_parts: List[str] = []

    for idx, row in enumerate(rows[1:], start=1):
        row_dict = dict(zip(headers, row))
        row_str = ", ".join(f"{k}: {v}" for k, v in row_dict.items() if v)
        if row_str:
            full_parts.append(row_str)
            sections.append(ParsedSection(text=row_str, section=f"Row {idx}"))

    return "\n".join(full_parts), sections


def _parse_json(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    text = file_bytes.decode("utf-8", errors="replace")
    try:
        data = json.loads(text)
        formatted = json.dumps(data, indent=2)
        return formatted, [ParsedSection(text=formatted, section="JSON Root")]
    except Exception:
        return text, [ParsedSection(text=text, section="Raw")]


def _parse_txt(file_bytes: bytes) -> Tuple[str, List[ParsedSection]]:
    text = file_bytes.decode("utf-8", errors="replace")
    return text, [ParsedSection(text=text, section="Document")]
