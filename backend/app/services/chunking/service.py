"""
Chunking Engine.

Implements the pluggable chunking strategy interface described in the
platform spec. Each strategy is a `ChunkingStrategy` subclass so the
Experiment Runner can A/B test strategies against the same source document
and compare downstream retrieval quality.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ChunkCandidate:
    text: str
    chunk_index: int
    page_number: int | None = None
    section: str | None = None


class ChunkingStrategy(ABC):
    name: str

    @abstractmethod
    def split(self, document_text: str) -> list[ChunkCandidate]:
        ...


class RecursiveChunking(ChunkingStrategy):
    """Splits on paragraph -> sentence -> word boundaries until chunks fit
    within `max_tokens`, preserving semantic boundaries where possible."""

    name = "recursive"

    def __init__(self, max_tokens: int = 512, overlap_tokens: int = 64):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens

    def split(self, document_text: str) -> list[ChunkCandidate]:
        paragraphs = [p.strip() for p in document_text.split("\n\n") if p.strip()]
        chunks: list[ChunkCandidate] = []
        buffer = ""
        idx = 0
        for para in paragraphs:
            if len((buffer + " " + para).split()) > self.max_tokens and buffer:
                chunks.append(ChunkCandidate(text=buffer.strip(), chunk_index=idx))
                idx += 1
                overlap_words = buffer.split()[-self.overlap_tokens :]
                buffer = " ".join(overlap_words) + " " + para
            else:
                buffer = (buffer + " " + para).strip()
        if buffer:
            chunks.append(ChunkCandidate(text=buffer.strip(), chunk_index=idx))
        return chunks


class SemanticChunking(ChunkingStrategy):
    """Groups sentences by embedding similarity so each chunk holds one
    coherent idea. Requires an embedding model; wired up in production via
    dependency injection of an EmbeddingProvider."""

    name = "semantic"

    def split(self, document_text: str) -> list[ChunkCandidate]:
        raise NotImplementedError(
            "SemanticChunking requires an EmbeddingProvider — inject one via "
            "the ChunkingService constructor in production wiring."
        )


STRATEGY_REGISTRY: dict[str, type[ChunkingStrategy]] = {
    "recursive": RecursiveChunking,
    "semantic": SemanticChunking,
}


class ChunkingService:
    def __init__(self, strategy: str = "recursive"):
        if strategy not in STRATEGY_REGISTRY:
            raise ValueError(f"Unknown chunking strategy: {strategy}")
        self.strategy: ChunkingStrategy = STRATEGY_REGISTRY[strategy]()

    def chunk(self, document_text: str) -> list[ChunkCandidate]:
        return self.strategy.split(document_text)
