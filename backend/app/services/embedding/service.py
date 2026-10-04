
"""
Embedding Service for Titan.

Provides local BGE embeddings through FastEmbed and optional
OpenAI embeddings, with vector count and dimension validation.
"""

import math
from abc import ABC, abstractmethod
from typing import List

import httpx
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings


class EmbeddingProvider(ABC):
    model_name: str
    dimensions: int

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        ...


class FastEmbedBGEProvider(EmbeddingProvider):
    """
    Local BGE embedding generation using FastEmbed and ONNX Runtime.
    """

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.dimensions = 384
        self._model = None

    def _get_model(self):
        if self._model is None:
            from fastembed import TextEmbedding

            self._model = TextEmbedding(model_name=self.model_name)

        return self._model

    def _embed_sync(self, texts: List[str]) -> List[List[float]]:
        """Run synchronous FastEmbed inference."""

        model = self._get_model()
        embeddings = list(model.embed(texts))

        return [embedding.tolist() for embedding in embeddings]

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Embedding input cannot contain empty text")

        embeddings = await run_in_threadpool(
            self._embed_sync,
            texts,
        )

        self._validate_embeddings(texts, embeddings)

        return embeddings

    def _validate_embeddings(
        self,
        texts: List[str],
        embeddings: List[List[float]],
    ) -> None:
        if len(embeddings) != len(texts):
            raise ValueError(
                f"Embedding count mismatch: expected {len(texts)}, "
                f"received {len(embeddings)}"
            )

        for index, vector in enumerate(embeddings):
            if len(vector) != self.dimensions:
                raise ValueError(
                    f"Invalid vector dimensions at index {index}: "
                    f"expected {self.dimensions}, received {len(vector)}"
                )

            if not all(
                isinstance(value, (int, float)) and math.isfinite(value)
                for value in vector
            ):
                raise ValueError(
                    f"Invalid numeric value in embedding at index {index}"
                )


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """
    Optional OpenAI embedding provider.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "text-embedding-3-small",
    ):
        if model_name != "text-embedding-3-small":
            raise ValueError(
                f"Unsupported OpenAI embedding model: {model_name}"
            )

        self.api_key = api_key
        self.model_name = model_name
        self.dimensions = 1536

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        if any(not isinstance(text, str) or not text.strip() for text in texts):
            raise ValueError("Embedding input cannot contain empty text")

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "input": texts,
                    "model": self.model_name,
                },
            )

            response.raise_for_status()
            data = response.json()

        items = sorted(data["data"], key=lambda item: item["index"])
        embeddings = [item["embedding"] for item in items]

        if len(embeddings) != len(texts):
            raise ValueError(
                f"Embedding count mismatch: expected {len(texts)}, "
                f"received {len(embeddings)}"
            )

        for index, vector in enumerate(embeddings):
            if len(vector) != self.dimensions:
                raise ValueError(
                    f"Invalid vector dimensions at index {index}: "
                    f"expected {self.dimensions}, received {len(vector)}"
                )

            if not all(
                isinstance(value, (int, float)) and math.isfinite(value)
                for value in vector
            ):
                raise ValueError(
                    f"Invalid numeric value in embedding at index {index}"
                )

        return embeddings


_global_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    global _global_provider

    if _global_provider is not None:
        return _global_provider

    settings = get_settings()
    model_name = settings.default_embedding_model

    if model_name == "BAAI/bge-small-en-v1.5":
        _global_provider = FastEmbedBGEProvider(
            model_name=model_name
        )

    elif model_name == "text-embedding-3-small":
        if not settings.openai_api_key:
            raise RuntimeError(
                "OpenAI API key is required for text-embedding-3-small"
            )

        _global_provider = OpenAIEmbeddingProvider(
            api_key=settings.openai_api_key,
            model_name=model_name,
        )

    else:
        raise ValueError(
            f"Unsupported embedding model configuration: {model_name}"
        )

    return _global_provider