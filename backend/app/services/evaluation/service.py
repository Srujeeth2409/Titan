"""
Evaluation Engine.

Computes retrieval metrics (Recall@K, Precision@K, MRR, NDCG) against a
labeled gold set, and generation metrics (faithfulness, relevance,
correctness) via LLM-as-judge or reference-based scoring. Every experiment
run persists per-query results so the Benchmark Runner can build
leaderboards across embedding/chunking/retriever/reranker/LLM combinations.
"""
import math


def recall_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    top_k = set(retrieved_ids[:k])
    return len(top_k & relevant_ids) / len(relevant_ids)


def precision_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    top_k = retrieved_ids[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for doc_id in top_k if doc_id in relevant_ids)
    return hits / len(top_k)


def mrr(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
    for rank, doc_id in enumerate(retrieved_ids, start=1):
        if doc_id in relevant_ids:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    dcg = sum(
        1.0 / math.log2(rank + 1)
        for rank, doc_id in enumerate(retrieved_ids[:k], start=1)
        if doc_id in relevant_ids
    )
    ideal_hits = min(len(relevant_ids), k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0
