
"""
Chunking Engine.

Provides pluggable chunking strategies for Titan.
RecursiveChunking splits documents using paragraph, sentence,
and word boundaries while maintaining controlled overlap.
"""

import re
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
    """
    Splits text using paragraph -> sentence -> word boundaries.

    Note:
        max_tokens and overlap_tokens are retained for compatibility
        with existing Titan code. Their current units are words,
        not actual model tokenizer tokens.
    """

    name = "recursive"

    def __init__(
        self,
        max_tokens: int = 512,
        overlap_tokens: int = 64,
    ):
        if max_tokens <= 0:
            raise ValueError("max_tokens must be greater than zero")

        if overlap_tokens < 0:
            raise ValueError("overlap_tokens cannot be negative")

        if overlap_tokens >= max_tokens:
            raise ValueError("overlap_tokens must be smaller than max_tokens")

        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens

    def _count_words(self, text: str) -> int:
        return len(text.split())

    def _split_long_sentence(self, sentence: str) -> list[str]:
        """Split an oversized sentence into word-bounded pieces."""

        words = sentence.split()

        if len(words) <= self.max_tokens:
            return [sentence]

        return [
            " ".join(words[i:i + self.max_tokens])
            for i in range(0, len(words), self.max_tokens)
        ]

    def _split_into_units(self, document_text: str) -> list[str]:
        """
        Extract sentence-sized units from paragraphs.
        Oversized sentences are split further at word boundaries.
        """

        paragraphs = re.split(r"\n\s*\n", document_text.strip())
        units = []

        for paragraph in paragraphs:
            paragraph = paragraph.strip()

            if not paragraph:
                continue

            sentences = re.split(
                r"(?<=[.!?])\s+",
                paragraph,
            )

            for sentence in sentences:
                sentence = sentence.strip()

                if sentence:
                    units.extend(self._split_long_sentence(sentence))

        return units

    def split(self, document_text: str) -> list[ChunkCandidate]:
        if not document_text or not document_text.strip():
            return []

        units = self._split_into_units(document_text)

        if not units:
            return []

        chunks: list[ChunkCandidate] = []
        buffer: list[str] = []

        for unit in units:
            unit_words = unit.split()

            if not unit_words:
                continue

            current_word_count = sum(
                len(part.split()) for part in buffer
            )

            unit_word_count = len(unit_words)

            if current_word_count + unit_word_count <= self.max_tokens:
                buffer.append(unit)
                continue

            # Save the current chunk.
            if buffer:
                chunks.append(
                    ChunkCandidate(
                        text=" ".join(buffer).strip(),
                        chunk_index=len(chunks),
                    )
                )

            # Retain as much overlap as possible without exceeding
            # the maximum size of the next chunk.
            previous_words = " ".join(buffer).split()

            allowed_overlap = min(
                self.overlap_tokens,
                self.max_tokens - unit_word_count,
            )

            overlap = previous_words[-allowed_overlap:] if allowed_overlap else []

            buffer = []

            if overlap:
                buffer.append(" ".join(overlap))

            buffer.append(unit)

        # Save the final chunk.
        if buffer:
            chunks.append(
                ChunkCandidate(
                    text=" ".join(buffer).strip(),
                    chunk_index=len(chunks),
                )
            )

        return chunks


class SemanticChunking(ChunkingStrategy):
    """
    Groups sentences by embedding similarity.

    Requires an EmbeddingProvider and is not implemented yet.
    """

    name = "semantic"

    def split(self, document_text: str) -> list[ChunkCandidate]:
        raise NotImplementedError(
            "SemanticChunking requires an EmbeddingProvider. "
            "Inject one through the ChunkingService constructor."
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