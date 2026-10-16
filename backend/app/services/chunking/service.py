"""
Chunking Engine for Titan.

Implements the pluggable chunking strategy interface described in the
platform spec. Each strategy is a `ChunkingStrategy` subclass so the
Experiment Runner can A/B test strategies against the same source document
and compare downstream retrieval quality.

Strategies supported:
1. RecursiveChunking: Splits on paragraph -> sentence -> word boundaries.
2. SlidingWindowChunking: Fixed token window with configurable overlap.
3. SectionAwareChunking: Preserves document structure & section headings.
4. SemanticChunking: Groups sentences based on cosine similarity of embeddings.
"""
from abc import ABC, abstractmethod
import asyncio
from dataclasses import dataclass
import math
import re
from typing import Any, List, Optional


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
    Splits on paragraph -> sentence -> word boundaries until chunks fit
    within `max_tokens`, preserving semantic boundaries where possible.
    """

    name = "recursive"

    def __init__(self, max_tokens: int = 512, overlap_tokens: int = 64):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens

    def _split_into_sentences(self, text: str) -> list[str]:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return [s.strip() for s in sentences if s.strip()]

    def split(self, document_text: str) -> list[ChunkCandidate]:
        if not document_text or not document_text.strip():
            return []

        raw_paragraphs = [p.strip() for p in document_text.split("\n\n") if p.strip()]
        paragraphs: list[str] = []

        for p in raw_paragraphs:
            if len(p.split()) > self.max_tokens:
                sents = self._split_into_sentences(p)
                paragraphs.extend(sents)
            else:
                paragraphs.append(p)

        chunks: list[ChunkCandidate] = []
        buffer_words: list[str] = []
        idx = 0

        for para in paragraphs:
            para_words = para.split()
            if not para_words:
                continue

            if len(buffer_words) + len(para_words) > self.max_tokens and buffer_words:
                chunk_text = " ".join(buffer_words)
                chunks.append(ChunkCandidate(text=chunk_text, chunk_index=idx))
                idx += 1

                overlap = buffer_words[-self.overlap_tokens :] if self.overlap_tokens > 0 else []
                buffer_words = overlap + para_words
            else:
                buffer_words.extend(para_words)

        if buffer_words:
            chunk_text = " ".join(buffer_words)
            chunks.append(ChunkCandidate(text=chunk_text, chunk_index=idx))

        return chunks


class SlidingWindowChunking(ChunkingStrategy):
    """
    Fixed-size token/word window that slides forward with a fixed overlap step.
    Provides predictable chunk sizes and maximum coverage.
    """

    name = "sliding_window"

    def __init__(self, window_size: int = 256, overlap: int = 64):
        self.window_size = window_size
        self.overlap = min(overlap, window_size - 1)
        self.step = max(1, self.window_size - self.overlap)

    def split(self, document_text: str) -> list[ChunkCandidate]:
        if not document_text or not document_text.strip():
            return []

        words = document_text.split()
        if not words:
            return []

        if len(words) <= self.window_size:
            return [ChunkCandidate(text=" ".join(words), chunk_index=0)]

        chunks: list[ChunkCandidate] = []
        idx = 0
        start = 0

        while start < len(words):
            end = min(start + self.window_size, len(words))
            chunk_words = words[start:end]
            chunks.append(ChunkCandidate(text=" ".join(chunk_words), chunk_index=idx))
            idx += 1

            if end == len(words):
                break
            start += self.step

        return chunks


class SectionAwareChunking(ChunkingStrategy):
    """
    Identifies document structure (Markdown headings, page markers, explicit sections)
    and chunks within section boundaries, ensuring section titles are prepended
    to chunks for contextual preservation.
    """

    name = "section_aware"

    def __init__(self, max_tokens: int = 400, overlap_tokens: int = 50):
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self._sub_chunker = RecursiveChunking(max_tokens=max_tokens, overlap_tokens=overlap_tokens)

    def split(self, document_text: str) -> list[ChunkCandidate]:
        if not document_text or not document_text.strip():
            return []

        lines = document_text.split("\n")
        sections: list[tuple[str, list[str]]] = []
        current_heading = "General"
        current_lines: list[str] = []

        heading_pattern = re.compile(r"^(#{1,6}\s+.*|[A-Z0-9\s]{3,}:?$|===+|---+)")

        for line in lines:
            stripped = line.strip()
            if heading_pattern.match(stripped) and len(stripped) > 2:
                if current_lines:
                    sections.append((current_heading, current_lines))
                    current_lines = []
                current_heading = stripped.lstrip("#").strip() or "General"
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_heading, current_lines))

        chunks: list[ChunkCandidate] = []
        idx = 0

        for heading, s_lines in sections:
            section_body = "\n".join(s_lines).strip()
            if not section_body:
                continue

            sub_chunks = self._sub_chunker.split(section_body)
            for sub in sub_chunks:
                text_with_context = (
                    f"[{heading}]\n{sub.text}" if heading != "General" and not sub.text.startswith(f"[{heading}]") else sub.text
                )
                chunks.append(
                    ChunkCandidate(
                        text=text_with_context,
                        chunk_index=idx,
                        section=heading,
                    )
                )
                idx += 1

        return chunks


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class SemanticChunking(ChunkingStrategy):
    """
    Groups consecutive sentences by embedding cosine similarity so each chunk holds
    a coherent semantic idea. When similarity drops below threshold, a new chunk starts.
    """

    name = "semantic"

    def __init__(
        self,
        similarity_threshold: float = 0.75,
        max_tokens: int = 512,
        embedding_provider: Optional[Any] = None,
    ):
        self.similarity_threshold = similarity_threshold
        self.max_tokens = max_tokens
        self._provider = embedding_provider

    def _get_provider(self):
        if self._provider is None:
            from app.services.embedding.service import get_embedding_provider
            self._provider = get_embedding_provider()
        return self._provider

    def _get_embeddings_sync(self, sentences: list[str]) -> list[list[float]]:
        provider = self._get_provider()
        if hasattr(provider, "_embed_sync"):
            return provider._embed_sync(sentences)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    return pool.submit(lambda: asyncio.run(provider.embed(sentences))).result()
            else:
                return loop.run_until_complete(provider.embed(sentences))
        except Exception:
            return asyncio.run(provider.embed(sentences))

    def split(self, document_text: str) -> list[ChunkCandidate]:
        if not document_text or not document_text.strip():
            return []

        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+|\n\n+", document_text)
            if s.strip()
        ]

        if not sentences:
            return []

        if len(sentences) == 1 or len(document_text.split()) <= 100:
            return [ChunkCandidate(text=document_text.strip(), chunk_index=0)]

        try:
            embeddings = self._get_embeddings_sync(sentences)
        except Exception:
            return RecursiveChunking(max_tokens=self.max_tokens).split(document_text)

        chunks: list[ChunkCandidate] = []
        current_chunk_sentences: list[str] = [sentences[0]]
        current_word_count = len(sentences[0].split())
        idx = 0

        for i in range(len(sentences) - 1):
            next_sent = sentences[i + 1]
            next_words = len(next_sent.split())
            sim = _cosine_similarity(embeddings[i], embeddings[i + 1])

            should_split = (sim < self.similarity_threshold) or (
                current_word_count + next_words > self.max_tokens
            )

            if should_split and current_chunk_sentences:
                chunks.append(
                    ChunkCandidate(
                        text=" ".join(current_chunk_sentences),
                        chunk_index=idx,
                    )
                )
                idx += 1
                current_chunk_sentences = [next_sent]
                current_word_count = next_words
            else:
                current_chunk_sentences.append(next_sent)
                current_word_count += next_words

        if current_chunk_sentences:
            chunks.append(
                ChunkCandidate(
                    text=" ".join(current_chunk_sentences),
                    chunk_index=idx,
                )
            )

        return chunks


STRATEGY_REGISTRY: dict[str, type[ChunkingStrategy]] = {
    "recursive": RecursiveChunking,
    "sliding_window": SlidingWindowChunking,
    "section_aware": SectionAwareChunking,
    "semantic": SemanticChunking,
}


class ChunkingService:
    def __init__(self, strategy: str = "recursive", **kwargs: Any):
        if strategy not in STRATEGY_REGISTRY:
            raise ValueError(
                f"Unknown chunking strategy '{strategy}'. Valid options: {list(STRATEGY_REGISTRY.keys())}"
            )
        self.strategy: ChunkingStrategy = STRATEGY_REGISTRY[strategy](**kwargs)

    def chunk(self, document_text: str) -> list[ChunkCandidate]:
        return self.strategy.split(document_text)

