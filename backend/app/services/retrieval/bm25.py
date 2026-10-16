"""
BM25 Sparse Retrieval Engine for Titan.

Implements BM25Okapi scoring for keyword/lexical search, matching the
spec requirement for Hybrid Retrieval (Dense Vector + Sparse Lexical).
Operates in-memory per collection and updates dynamically as chunks
are ingested.
"""
from collections import Counter
import math
import re
from typing import Any, Dict, List, Optional, Tuple


def tokenize(text: str) -> List[str]:
    """Tokenize and normalize text for BM25 lexical matching."""
    text = text.lower()
    # Extract alphanumeric tokens
    tokens = re.findall(r"\b[a-z0-9_]+\b", text)
    return tokens


class BM25Index:
    """
    In-memory BM25Okapi index with support for multiple collections.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size: int = 0
        self.avgdl: float = 0.0
        self.doc_lengths: List[int] = []
        self.doc_ids: List[str] = []
        self.doc_payloads: List[dict] = []
        self.doc_freqs: List[Dict[str, int]] = []
        self.idf: Dict[str, float] = {}

    def index_chunks(self, chunks: List[dict]):
        """
        Builds the BM25 index from a list of chunk dicts.
        Each dict should contain: 'id' or 'chunk_id', 'text', and optional metadata.
        """
        self.doc_ids = []
        self.doc_payloads = []
        self.doc_lengths = []
        self.doc_freqs = []
        total_len = 0

        # Term document frequency (how many docs contain term t)
        df: Dict[str, int] = Counter()

        for chunk in chunks:
            chunk_id = str(chunk.get("id") or chunk.get("chunk_id", ""))
            text = chunk.get("text", "")
            tokens = tokenize(text)
            doc_len = len(tokens)

            self.doc_ids.append(chunk_id)
            self.doc_payloads.append(chunk)
            self.doc_lengths.append(doc_len)
            total_len += doc_len

            freqs = Counter(tokens)
            self.doc_freqs.append(freqs)

            for term in freqs.keys():
                df[term] += 1

        self.corpus_size = len(self.doc_ids)
        self.avgdl = (total_len / self.corpus_size) if self.corpus_size > 0 else 0.0

        # Compute Robertson-Spärck Jones IDF
        self.idf = {}
        for term, freq in df.items():
            # BM25 standard formula with smoothing
            val = (self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0
            self.idf[term] = math.log(max(val, 1e-6))

    def search(self, query: str, top_k: int = 50) -> List[Tuple[dict, float]]:
        """
        Scores the corpus against the query and returns top_k (chunk_dict, score) pairs.
        """
        if self.corpus_size == 0:
            return []

        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        scores: List[float] = [0.0] * self.corpus_size

        for term in query_tokens:
            if term not in self.idf:
                continue

            idf_val = self.idf[term]
            for doc_idx in range(self.corpus_size):
                tf = self.doc_freqs[doc_idx].get(term, 0)
                if tf == 0:
                    continue

                doc_len = self.doc_lengths[doc_idx]
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / (self.avgdl or 1.0)))
                scores[doc_idx] += idf_val * (numerator / max(denominator, 1e-6))

        # Rank documents
        ranked_indices = sorted(
            range(self.corpus_size),
            key=lambda idx: scores[idx],
            reverse=True,
        )

        results = []
        for idx in ranked_indices[:top_k]:
            if scores[idx] > 0.0:
                results.append((self.doc_payloads[idx], scores[idx]))

        return results


class BM25Manager:
    """Manages separate BM25 indices per collection."""

    def __init__(self):
        self.indices: Dict[str, BM25Index] = {}

    def get_index(self, collection: str = "default") -> BM25Index:
        if collection not in self.indices:
            self.indices[collection] = BM25Index()
        return self.indices[collection]

    def index_collection(self, collection: str, chunks: List[dict]):
        idx = self.get_index(collection)
        idx.index_chunks(chunks)


_global_bm25_manager: Optional[BM25Manager] = None


def get_bm25_manager() -> BM25Manager:
    global _global_bm25_manager
    if _global_bm25_manager is None:
        _global_bm25_manager = BM25Manager()
    return _global_bm25_manager
