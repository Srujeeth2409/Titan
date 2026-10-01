"""
Reranking Engine.

Cross-encoder style rerankers score (query, chunk) pairs directly, giving
much higher precision than embedding-similarity alone at the cost of
latency — hence the Benchmark Runner tracks quality *and* latency/cost per
reranker so teams can pick the right point on that curve per workload.
"""
from abc import ABC, abstractmethod


class Reranker(ABC):
    name: str

    @abstractmethod
    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        """Returns candidate indices in descending relevance order."""


class BGEReranker(Reranker):
    name = "bge-reranker-large"

    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        raise NotImplementedError("Wire up the BGE cross-encoder checkpoint")


class NoOpReranker(Reranker):
    """Used as the control arm in reranker A/B experiments."""

    name = "none"

    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        return list(range(min(top_n, len(candidates))))
