"""
Reranking Engine for Titan.

Cross-encoder style rerankers score (query, chunk) pairs directly, giving
much higher precision than embedding-similarity alone.
"""
from abc import ABC, abstractmethod
import json
import re
from typing import List, Optional

from app.core.config import get_settings


class Reranker(ABC):
    name: str

    @abstractmethod
    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        """Returns candidate indices in descending relevance order."""
        ...


class NoOpReranker(Reranker):
    """Used as the control arm in reranker A/B experiments."""

    name = "none"

    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        return list(range(min(top_n, len(candidates))))


class LLMReranker(Reranker):
    """
    Reranker using Ollama / LLMGateway as a zero-shot relevance judge.
    Scores candidates against the query and ranks them in descending relevance order.
    """

    name = "llm-reranker"

    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        if not candidates:
            return []
        if len(candidates) <= 1:
            return [0]

        from app.services.llm_gateway.service import get_llm_gateway

        gateway = get_llm_gateway()
        # Cap candidate list for prompt efficiency
        eval_candidates = candidates[:15]

        passages_text = "\n".join(
            f"[{idx}] {text[:300].strip()}" for idx, text in enumerate(eval_candidates)
        )

        system_prompt = (
            "You are an expert document relevance reranker. "
            "Given a user query and numbered passages, evaluate how well each passage directly answers or provides context for the query. "
            "Output ONLY a valid JSON array of passage indices ordered from MOST relevant to LEAST relevant. "
            "Example format: [2, 0, 1]. Do not explain. Do not include markdown tags."
        )

        user_prompt = f"Query: {query}\n\nPassages:\n{passages_text}\n\nJSON array of ranked indices:"

        try:
            response = await gateway.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            raw = response.text.strip()
            # Extract JSON array
            match = re.search(r"\[[\d\s,]+\]", raw)
            if match:
                ranked = json.loads(match.group(0))
                # Validate indices
                valid_ranked = [
                    int(i)
                    for i in ranked
                    if isinstance(i, int) and 0 <= i < len(eval_candidates)
                ]
                # Add any missing indices at the end
                seen = set(valid_ranked)
                for i in range(len(eval_candidates)):
                    if i not in seen:
                        valid_ranked.append(i)
                # Append any remaining candidates beyond the eval cap
                for i in range(len(eval_candidates), len(candidates)):
                    valid_ranked.append(i)
                return valid_ranked[:top_n]
        except Exception as e:
            print(f"[LLMReranker] Reranking fallback triggered: {e}")

        # Fallback: keep original rank
        return list(range(min(top_n, len(candidates))))


class BGEReranker(Reranker):
    """
    BGE Reranker. Uses FastEmbed CrossEncoder if available, otherwise delegates to LLMReranker.
    """

    name = "bge-reranker"

    def __init__(self):
        self._llm_reranker = LLMReranker()

    async def rerank(self, query: str, candidates: list[str], top_n: int) -> list[int]:
        try:
            from fastembed.rerank.cross_encoder import TextCrossEncoder
            from starlette.concurrency import run_in_threadpool

            def _sync_rerank():
                encoder = TextCrossEncoder(model_name="BAAI/bge-reranker-base")
                scores = list(encoder.rerank(query, candidates))
                # Sort indices by score descending
                ranked_pairs = sorted(
                    enumerate(scores), key=lambda x: x[1], reverse=True
                )
                return [idx for idx, _ in ranked_pairs[:top_n]]

            return await run_in_threadpool(_sync_rerank)
        except Exception:
            # Fall back gracefully to LLMReranker
            return await self._llm_reranker.rerank(query, candidates, top_n)


RERANKER_REGISTRY = {
    "none": NoOpReranker,
    "noop": NoOpReranker,
    "llm": LLMReranker,
    "bge": BGEReranker,
    "bge-reranker-large": BGEReranker,
    "default": LLMReranker,
}


def get_reranker(name: str = "default") -> Reranker:
    clean_name = name.lower().strip()
    cls = RERANKER_REGISTRY.get(clean_name, LLMReranker)
    return cls()

