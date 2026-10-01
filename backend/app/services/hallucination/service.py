"""
Hallucination Detection.

Flags unsupported claims, missing citations, and contradictions between the
generated answer and the retrieved context. In production this is backed by
a natural-language-inference (NLI) model or an LLM-as-judge call, scored and
logged so trends surface on the Analytics Dashboard.
"""
from dataclasses import dataclass


@dataclass
class HallucinationReport:
    score: float  # 0 = fully grounded, 1 = fully unsupported
    unsupported_claims: list[str]
    contradictions: list[str]


class HallucinationDetector:
    async def check(self, answer: str, context_chunks: list[str]) -> HallucinationReport:
        raise NotImplementedError(
            "Wire up an NLI model or LLM-as-judge call comparing `answer` "
            "sentence-by-sentence against `context_chunks`"
        )
