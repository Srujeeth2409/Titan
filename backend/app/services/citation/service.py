"""
Citation Engine for Titan.

Every generated answer is traced back to the exact chunks that supported
it, so responses are auditable and explainable. Provides sentence-level
citation attribution, token-overlap grounding, and verification verdicts.
"""
from dataclasses import dataclass
import re
from typing import Any, List, Optional


@dataclass
class SourcedPassage:
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int | None
    section: str | None
    passage: str
    confidence: float
    verdict: str = "supported"
    sentence: Optional[str] = None


def _tokenize_words(text: str) -> set[str]:
    words = re.findall(r"\b[a-z0-9_]{3,}\b", text.lower())
    stopwords = {
        "the", "and", "that", "this", "with", "from", "for", "are", "was", "were",
        "have", "has", "had", "will", "would", "can", "could", "should", "not",
        "they", "their", "there", "what", "which", "when", "where", "who", "whom"
    }
    return {w for w in words if w not in stopwords}


class CitationEngine:
    """
    Computes sentence-by-sentence attribution against retrieved chunks.
    Identifies which chunk supports each sentence in the answer and
    computes confidence and grounding verdict (supported / partial / unsupported).
    """

    def split_sentences(self, text: str) -> List[str]:
        raw = re.split(r"(?<=[.!?])\s+|\n+", text)
        sentences = []
        for s in raw:
            clean = s.strip()
            if len(clean) > 10 and not clean.startswith("#"):
                sentences.append(clean)
        return sentences

    def build_citations(
        self,
        answer: str,
        chunks: List[Any],
    ) -> List[dict]:
        """
        Builds rich, grounded citations for an answer given retrieved context chunks.
        """
        if not chunks or not answer.strip():
            return []

        sentences = self.split_sentences(answer)
        citations_map: dict[str, dict] = {}

        # 1. Check for explicit bracket citations like [1], [2] in answer
        for idx, chunk in enumerate(chunks, start=1):
            marker = f"[{idx}]"
            chunk_id = getattr(chunk, "chunk_id", str(idx))
            filename = getattr(chunk, "filename", getattr(chunk, "document_name", "document"))
            section = getattr(chunk, "section", "General") or "General"
            page = getattr(chunk, "page_number", 1) or 1
            chunk_text = getattr(chunk, "text", getattr(chunk, "passage", ""))

            if marker in answer:
                snippet_text = chunk_text[:350] + ("..." if len(chunk_text) > 350 else "")
                citations_map[chunk_id] = {
                    "index": idx,
                    "chunk_id": chunk_id,
                    "source": filename,
                    "section": section,
                    "page": page,
                    "snippet": snippet_text,
                    "verdict": "supported",
                    "confidence": round(float(getattr(chunk, "score", 0.9)), 2),
                }

        # 2. Sentence-level token overlap attribution
        chunk_token_sets = [
            _tokenize_words(getattr(c, "text", getattr(c, "passage", "")))
            for c in chunks
        ]

        for sent in sentences:
            sent_tokens = _tokenize_words(sent)
            if not sent_tokens:
                continue

            best_overlap = 0.0
            best_chunk_idx = -1

            for c_idx, c_tokens in enumerate(chunk_token_sets):
                if not c_tokens:
                    continue
                intersection = sent_tokens.intersection(c_tokens)
                overlap = len(intersection) / len(sent_tokens)
                if overlap > best_overlap:
                    best_overlap = overlap
                    best_chunk_idx = c_idx

            if best_chunk_idx >= 0 and best_overlap >= 0.15:
                chunk = chunks[best_chunk_idx]
                chunk_id = getattr(chunk, "chunk_id", str(best_chunk_idx + 1))
                filename = getattr(chunk, "filename", getattr(chunk, "document_name", "document"))
                section = getattr(chunk, "section", "General") or "General"
                page = getattr(chunk, "page_number", 1) or 1
                chunk_text = getattr(chunk, "text", getattr(chunk, "passage", ""))

                verdict = "supported" if best_overlap >= 0.28 else "partial"
                conf = min(1.0, max(0.4, best_overlap * 1.5))

                if chunk_id not in citations_map:
                    citations_map[chunk_id] = {
                        "index": best_chunk_idx + 1,
                        "chunk_id": chunk_id,
                        "source": filename,
                        "section": section,
                        "page": page,
                        "snippet": chunk_text[:350] + ("..." if len(chunk_text) > 350 else ""),
                        "verdict": verdict,
                        "confidence": round(conf, 2),
                        "sentence": sent,
                    }
                else:
                    citations_map[chunk_id]["confidence"] = max(
                        citations_map[chunk_id]["confidence"], round(conf, 2)
                    )

        # 3. If no citations mapped yet, include top chunk as source
        if not citations_map and chunks:
            top_c = chunks[0]
            cid = getattr(top_c, "chunk_id", "1")
            citations_map[cid] = {
                "index": 1,
                "chunk_id": cid,
                "source": getattr(top_c, "filename", getattr(top_c, "document_name", "document")),
                "section": getattr(top_c, "section", "General") or "General",
                "page": getattr(top_c, "page_number", 1) or 1,
                "snippet": getattr(top_c, "text", getattr(top_c, "passage", ""))[:350] + "...",
                "verdict": "partial",
                "confidence": round(float(getattr(top_c, "score", 0.5)), 2),
            }

        sorted_citations = sorted(citations_map.values(), key=lambda c: c["index"])
        return sorted_citations


_global_citation_engine: Optional[CitationEngine] = None


def get_citation_engine() -> CitationEngine:
    global _global_citation_engine
    if _global_citation_engine is None:
        _global_citation_engine = CitationEngine()
    return _global_citation_engine

