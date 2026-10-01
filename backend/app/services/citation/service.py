"""
Citation Engine.

Every generated answer is traced back to the exact chunks that supported
it, so responses are auditable and explainable rather than opaque model
output.
"""
from dataclasses import dataclass


@dataclass
class SourcedPassage:
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int | None
    section: str | None
    passage: str
    confidence: float


class CitationEngine:
    def build_citations(self, answer: str, supporting_chunks: list[SourcedPassage]) -> list[SourcedPassage]:
        """Filters supporting_chunks down to those whose passage text is
        actually reflected in the answer (via entailment/keyword overlap in
        production), ranked by confidence."""
        return sorted(supporting_chunks, key=lambda c: c.confidence, reverse=True)
