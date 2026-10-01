"""
LLM Gateway for Titan.

Multi-provider routing supporting:
- Groq (Free high-speed inference: Llama 3.3 70B, Qwen 2.5 32B, Gemma 2 9B)
- OpenRouter (Free overflow tier: Llama 3.3 70B:free, Qwen 2.5:free)
- Anthropic (Claude 3.5 Sonnet)
- OpenAI (GPT-4o)
- Local Ollama (Qwen, Llama local)

Supports asynchronous token streaming for Server-Sent Events (SSE)
and automatic rate-limit failover from Groq -> OpenRouter.
"""
from dataclasses import dataclass
import json
from typing import AsyncIterator, Optional
import httpx

from app.core.config import get_settings

settings = get_settings()


@dataclass
class LLMResponse:
    text: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0


class LLMGateway:
    def __init__(self):
        self.anthropic_key = settings.anthropic_api_key
        self.openai_key = settings.openai_api_key
        self.groq_key = settings.groq_api_key
        self.openrouter_key = settings.openrouter_api_key
        self.ollama_base_url = settings.ollama_base_url.rstrip("/")

    async def stream_generate(
        self,
        system_prompt: str,
        user_prompt: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        """
        Stream tokens from the selected provider with automatic fallback.
        Tiers:
          - Strong: Llama 3.3 70B (Groq) or Claude 3.5 Sonnet
          - Fast: Qwen 2.5 32B or Gemma 2 9B (Groq)
          - Overflow / Backup: OpenRouter (:free models)
        """
        selected_provider = (provider or settings.default_llm_provider).lower()

        # 1. Explicit Groq or strong/fast tier
        if "groq" in selected_provider or selected_provider in ("strong", "fast"):
            target_model = model or ("llama-3.3-70b-versatile" if selected_provider == "strong" else "qwen-2.5-32b")
            try:
                if self.groq_key:
                    async for token in self._stream_groq(system_prompt, user_prompt, target_model, max_tokens):
                        yield token
                    return
                elif self.openrouter_key:
                    # Failover to OpenRouter if Groq key isn't provided
                    or_model = f"meta-llama/llama-3.3-70b-instruct:free" if "llama" in target_model else "qwen/qwen-2.5-72b-instruct:free"
                    async for token in self._stream_openrouter(system_prompt, user_prompt, or_model, max_tokens):
                        yield token
                    return
            except Exception as e:
                # Automatic failover to OpenRouter on Groq rate limit / error
                if self.openrouter_key:
                    print(f"[LLMGateway] Groq failed ({e}), failing over to OpenRouter...")
                    or_model = "meta-llama/llama-3.3-70b-instruct:free"
                    async for token in self._stream_openrouter(system_prompt, user_prompt, or_model, max_tokens):
                        yield token
                    return
                raise e

        # 2. OpenRouter explicit
        if "openrouter" in selected_provider:
            if not self.openrouter_key:
                raise ValueError("OPENROUTER_API_KEY is not configured in .env")
            target_model = model or "meta-llama/llama-3.3-70b-instruct:free"
            async for token in self._stream_openrouter(system_prompt, user_prompt, target_model, max_tokens):
                yield token
            return

        # 3. Local Ollama / Qwen
        if "ollama" in selected_provider or "local" in selected_provider:
            async for token in self._stream_ollama(system_prompt, user_prompt, model or "qwen2.5"):
                yield token
            return

        # 4. OpenAI
        if "openai" in selected_provider or "gpt" in selected_provider:
            if not self.openai_key:
                raise ValueError("OPENAI_API_KEY is not configured in .env")
            async for token in self._stream_openai(system_prompt, user_prompt, model or "gpt-4o", max_tokens):
                yield token
            return

        # 5. Anthropic Claude 3.5 Sonnet (Default if key provided)
        if self.anthropic_key:
            async for token in self._stream_anthropic(
                system_prompt, user_prompt, model or "claude-3-5-sonnet-20241022", max_tokens
            ):
                yield token
            return

        # 6. Automatic fallbacks if Anthropic key not yet populated
        if self.groq_key:
            async for token in self._stream_groq(
                system_prompt, user_prompt, model or "llama-3.3-70b-versatile", max_tokens
            ):
                yield token
            return

        if self.openrouter_key:
            async for token in self._stream_openrouter(
                system_prompt, user_prompt, "meta-llama/llama-3.3-70b-instruct:free", max_tokens
            ):
                yield token
            return

        # If no keys configured
        raise ValueError(
            "No LLM API keys configured. Please add ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY to your .env file."
        )

    async def _stream_groq(
        self, system_prompt: str, user_prompt: str, model: str, max_tokens: int
    ) -> AsyncIterator[str]:
        """Stream via Groq fast inference (OpenAI-compatible)."""
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST", "https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    raise RuntimeError(f"Groq API error ({response.status_code}): {err_body.decode('utf-8', errors='replace')}")

                async for line in response.aiter_lines():
                    trimmed = line.strip()
                    if not trimmed.startswith("data:"):
                        continue
                    data_str = trimmed[5:].strip()
                    if data_str == "[DONE]" or not data_str:
                        continue
                    try:
                        event = json.loads(data_str)
                        choices = event.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                yield text
                    except json.JSONDecodeError:
                        continue

    async def _stream_openrouter(
        self, system_prompt: str, user_prompt: str, model: str, max_tokens: int
    ) -> AsyncIterator[str]:
        """Stream via OpenRouter (OpenAI-compatible)."""
        headers = {
            "Authorization": f"Bearer {self.openrouter_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Titan Document Intelligence",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            async with client.stream(
                "POST", "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    raise RuntimeError(f"OpenRouter error ({response.status_code}): {err_body.decode('utf-8', errors='replace')}")

                async for line in response.aiter_lines():
                    trimmed = line.strip()
                    if not trimmed.startswith("data:"):
                        continue
                    data_str = trimmed[5:].strip()
                    if data_str == "[DONE]" or not data_str:
                        continue
                    try:
                        event = json.loads(data_str)
                        choices = event.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                yield text
                    except json.JSONDecodeError:
                        continue

    async def _stream_anthropic(
        self, system_prompt: str, user_prompt: str, model: str, max_tokens: int
    ) -> AsyncIterator[str]:
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    raise RuntimeError(f"Anthropic API error ({response.status_code}): {err_body.decode('utf-8', errors='replace')}")

                async for line in response.aiter_lines():
                    trimmed = line.strip()
                    if not trimmed.startswith("data:"):
                        continue
                    data_str = trimmed[5:].strip()
                    if not data_str:
                        continue
                    try:
                        event = json.loads(data_str)
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {})
                            if delta.get("type") == "text_delta":
                                yield delta.get("text", "")
                    except json.JSONDecodeError:
                        continue

    async def _stream_openai(
        self, system_prompt: str, user_prompt: str, model: str, max_tokens: int
    ) -> AsyncIterator[str]:
        headers = {
            "Authorization": f"Bearer {self.openai_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST", "https://api.openai.com/v1/chat/completions", headers=headers, json=payload
            ) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    raise RuntimeError(f"OpenAI error ({response.status_code}): {err_body.decode('utf-8', errors='replace')}")

                async for line in response.aiter_lines():
                    trimmed = line.strip()
                    if not trimmed.startswith("data:"):
                        continue
                    data_str = trimmed[5:].strip()
                    if data_str == "[DONE]" or not data_str:
                        continue
                    try:
                        event = json.loads(data_str)
                        choices = event.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            text = delta.get("content", "")
                            if text:
                                yield text
                    except json.JSONDecodeError:
                        continue

    async def _stream_ollama(
        self, system_prompt: str, user_prompt: str, model: str
    ) -> AsyncIterator[str]:
        url = f"{self.ollama_base_url}/api/chat"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.status_code != 200:
                    err_body = await response.aread()
                    raise RuntimeError(f"Ollama error ({response.status_code}): {err_body.decode('utf-8', errors='replace')}. Is Ollama running on {self.ollama_base_url}?")

                async for line in response.aiter_lines():
                    trimmed = line.strip()
                    if not trimmed:
                        continue
                    try:
                        event = json.loads(trimmed)
                        msg = event.get("message", {})
                        content = msg.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> LLMResponse:
        full_text = []
        async for token in self.stream_generate(system_prompt, user_prompt, provider, model):
            full_text.append(token)
        text = "".join(full_text)
        return LLMResponse(text=text, model=model or "default")


_global_llm_gateway: LLMGateway | None = None


def get_llm_gateway() -> LLMGateway:
    global _global_llm_gateway
    if _global_llm_gateway is None:
        _global_llm_gateway = LLMGateway()
    return _global_llm_gateway
