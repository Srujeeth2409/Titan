"""
Hallucination Detection Engine for Titan.

Flags unsupported claims, missing citations, and contradictions between the
generated answer and the retrieved context. Powered by LLM-as-judge with
fast token/n-gram grounding fallback.
"""
from dataclasses import dataclass
import json
import re
from typing import List, Optional


@dataclass
class HallucinationReport:
    score: float  # 0.0 = fully grounded, 1.0 = fully unsupported/hallucinated
    unsupported_claims: list[str]
    contradictions: list[str]
    supported_claims: list[str]
    total_claims: int = 0


class HallucinationDetector:
    """
    Evaluates whether the statements in `answer` are supported by `context_chunks`.
    Extracts factual claims, evaluates grounding via LLM judge (with lexical fallback),
    and produces an auditable HallucinationReport.
    """

    def extract_claims(self, text: str) -> list[str]:
        raw = re.split(r"(?<=[.!?])\s+|\n+", text)
        claims = []
        boilerplate_prefixes = (
            "here is", "based on", "according to", "in summary", "sure,",
            "certainly", "hope this helps", "let me know", "to summarize"
        )
        for s in raw:
            s_clean = s.strip()
            if len(s_clean.split()) >= 4 and not s_clean.startswith("#"):
                lowered = s_clean.lower()
                if not any(lowered.startswith(b) for b in boilerplate_prefixes):
                    claims.append(s_clean)
        return claims

    async def check(
        self,
        answer: str,
        context_chunks: list[str],
    ) -> HallucinationReport:
        if not answer.strip():
            return HallucinationReport(
                score=0.0,
                unsupported_claims=[],
                contradictions=[],
                supported_claims=[],
                total_claims=0,
            )

        claims = self.extract_claims(answer)
        if not claims:
            return HallucinationReport(
                score=0.0,
                unsupported_claims=[],
                contradictions=[],
                supported_claims=[],
                total_claims=0,
            )

        if not context_chunks:
            return HallucinationReport(
                score=1.0,
                unsupported_claims=claims,
                contradictions=[],
                supported_claims=[],
                total_claims=len(claims),
            )

        # 1. Try LLM-as-judge verification
        try:
            from app.services.llm_gateway.service import get_llm_gateway
            gateway = get_llm_gateway()

            context_blob = "\n\n".join(f"[Passage {i+1}]: {p[:400]}" for i, p in enumerate(context_chunks[:6]))
            claims_blob = "\n".join(f"{i+1}. {c}" for i, c in enumerate(claims[:8]))

            system_prompt = (
                "You are an impartial natural language inference (NLI) evaluator. "
                "Given reference context passages and a list of claims from an answer, "
                "determine for EACH claim whether it is SUPPORTED, CONTRADICTED, or NOT_ENOUGH_INFO. "
                "Output ONLY a valid JSON array of objects in this exact format: "
                '[{"claim_index": 1, "verdict": "SUPPORTED" | "CONTRADICTED" | "NOT_ENOUGH_INFO"}]. '
                "Do not include explanation or markdown."
            )

            user_prompt = f"Reference Context:\n{context_blob}\n\nClaims to evaluate:\n{claims_blob}\n\nJSON array:"

            resp = await gateway.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )

            match = re.search(r"\[\s*\{.*\}\s*\]", resp.text.strip(), re.DOTALL)
            if match:
                results = json.loads(match.group(0))
                supported = []
                unsupported = []
                contradictions = []

                for item in results:
                    c_idx = item.get("claim_index", 1) - 1
                    verdict = str(item.get("verdict", "")).upper()
                    if 0 <= c_idx < len(claims):
                        claim_text = claims[c_idx]
                        if "SUPPORT" in verdict:
                            supported.append(claim_text)
                        elif "CONTRADICT" in verdict:
                            contradictions.append(claim_text)
                        else:
                            unsupported.append(claim_text)

                total = len(supported) + len(unsupported) + len(contradictions)
                if total > 0:
                    score = (len(unsupported) + 2.0 * len(contradictions)) / (total * 2.0)
                    return HallucinationReport(
                        score=round(min(1.0, max(0.0, score)), 2),
                        unsupported_claims=unsupported,
                        contradictions=contradictions,
                        supported_claims=supported,
                        total_claims=total,
                    )
        except Exception as e:
            print(f"[HallucinationDetector] Fallback to lexical analysis: {e}")

        # 2. Fast lexical / token-containment fallback
        context_words = set(re.findall(r"\b[a-z0-9_]{3,}\b", " ".join(context_chunks).lower()))
        supported = []
        unsupported = []

        for claim in claims:
            claim_words = [w for w in re.findall(r"\b[a-z0-9_]{3,}\b", claim.lower())]
            if not claim_words:
                supported.append(claim)
                continue
            matched = sum(1 for w in claim_words if w in context_words)
            ratio = matched / len(claim_words)
            if ratio >= 0.40:
                supported.append(claim)
            else:
                unsupported.append(claim)

        score = len(unsupported) / len(claims) if claims else 0.0
        return HallucinationReport(
            score=round(score, 2),
            unsupported_claims=unsupported,
            contradictions=[],
            supported_claims=supported,
            total_claims=len(claims),
        )


_global_detector: Optional[HallucinationDetector] = None


def get_hallucination_detector() -> HallucinationDetector:
    global _global_detector
    if _global_detector is None:
        _global_detector = HallucinationDetector()
    return _global_detector

