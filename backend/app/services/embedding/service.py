"""
Embedding Service for Titan.

Provides fast, local embedding generation via FastEmbed (BAAI/bge-small-en-v1.5)
with zero third-party API dependencies or cost, and optional OpenAI embeddings.
"""
from abc import ABC, abstractmethod
from typing import List
import httpx

from app.core.config import get_settings

settings = get_settings()


class EmbeddingProvider(ABC):
    model_name: str
    dimensions: int

    @abstractmethod
    async def embed(self, texts: List[str]) -> List[List[float]]:
        ...


class FastEmbedBGEProvider(EmbeddingProvider):
    """
    FastEmbed runs ONNX runtime locally on CPU/GPU.
    Zero external API keys, zero token fees, sub-10ms inference.
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

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        model = self._get_model()
        # FastEmbed returns a generator of numpy arrays
        embeddings = list(model.embed(texts))
        return [emb.tolist() for emb in embeddings]


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model_name: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model_name = model_name
        self.dimensions = 1536

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={"input": texts, "model": self.model_name},
            )
            resp.raise_for_status()
            data = resp.json()
            return [item["embedding"] for item in data["data"]]


_global_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    global _global_provider
    if _global_provider is None:
        if settings.default_embedding_model.startswith("text-embedding") and settings.openai_api_key:
            _global_provider = OpenAIEmbeddingProvider(api_key=settings.openai_api_key)
        else:
            _global_provider = FastEmbedBGEProvider()
    return _global_provider
