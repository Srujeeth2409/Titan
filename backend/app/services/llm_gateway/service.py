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

    async def get_installed_ollama_models(self) -> list[str]:
        """Fetch list of model names currently pulled in local Ollama."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.ollama_base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
                    return models
        except Exception as e:
            print(f"[LLMGateway] Ollama tags check failed: {e}")
        return []

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
          - Local: Ollama (Qwen 2.5 3B / 1.5B with auto-discovery)
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

        # 3. Local Ollama / Qwen with resilient multi-tier fallback
        if "ollama" in selected_provider or "local" in selected_provider:
            target_model = model or settings.default_model or "qwen2.5:3b"
            ollama_error = None
            try:
                async for token in self._stream_ollama(system_prompt, user_prompt, target_model):
                    yield token
                return
            except Exception as e:
                ollama_error = e
                print(f"[LLMGateway] Primary Ollama model '{target_model}' failed ({e}). Checking local model fallbacks...")

            # Tier 3a: Discover what models are actually installed in Ollama
            installed = await self.get_installed_ollama_models()
            alt_model = None
            if installed:
                # Priority: qwen2.5:1.5b, or any other qwen, or any llama/mistral, or first available
                candidates = [
                    m for m in installed
                    if m != target_model and any(k in m.lower() for k in ["qwen2.5:1.5b", "qwen", "llama", "mistral", "gemma", "phi"])
                ]
                alt_model = candidates[0] if candidates else (installed[0] if installed[0] != target_model else None)

            if alt_model:
                try:
                    yield f"> *[Notice: Local model '{target_model}' not found in Ollama. Automatically falling back to installed '{alt_model}']*\n\n"
                    async for token in self._stream_ollama(system_prompt, user_prompt, alt_model):
                        yield token
                    return
                except Exception as alt_err:
                    print(f"[LLMGateway] Fallback to installed Ollama model '{alt_model}' also failed: {alt_err}")

            # Tier 3b: Fallover to Cloud API if any key is configured
            if self.groq_key:
                try:
                    yield f"> *[Notice: Ollama '{target_model}' unavailable. Falling back to Groq]*\n\n"
                    async for token in self._stream_groq(system_prompt, user_prompt, "llama-3.3-70b-versatile", max_tokens):
                        yield token
                    return
                except Exception as groq_err:
                    print(f"[LLMGateway] Groq failover failed: {groq_err}")

            if self.openrouter_key:
                try:
                    yield f"> *[Notice: Ollama '{target_model}' unavailable. Falling back to OpenRouter]*\n\n"
                    async for token in self._stream_openrouter(system_prompt, user_prompt, "meta-llama/llama-3.3-70b-instruct:free", max_tokens):
                        yield token
                    return
                except Exception as or_err:
                    print(f"[LLMGateway] OpenRouter failover failed: {or_err}")

            if self.openai_key:
                try:
                    yield f"> *[Notice: Ollama '{target_model}' unavailable. Falling back to OpenAI]*\n\n"
                    async for token in self._stream_openai(system_prompt, user_prompt, "gpt-4o", max_tokens):
                        yield token
                    return
                except Exception as oai_err:
                    print(f"[LLMGateway] OpenAI failover failed: {oai_err}")

            if self.anthropic_key:
                try:
                    yield f"> *[Notice: Ollama '{target_model}' unavailable. Falling back to Claude]*\n\n"
                    async for token in self._stream_anthropic(system_prompt, user_prompt, "claude-3-5-sonnet-20241022", max_tokens):
                        yield token
                    return
                except Exception as ant_err:
                    print(f"[LLMGateway] Anthropic failover failed: {ant_err}")

            # If all failed, re-raise with clear instructions so extractive fallback kicks in
            raise RuntimeError(
                f"Ollama model '{target_model}' is not installed locally. "
                f"Run `ollama pull {target_model}` in your terminal, or configure GROQ_API_KEY / OPENROUTER_API_KEY in .env."
            )

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
            "X-Title": "Titan RAG System",
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
            "options": {
                "temperature": 0.2,
                "num_ctx": 4096,
                "num_predict": 1024,
            },
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
