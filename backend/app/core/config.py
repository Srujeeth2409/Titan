"""
Central application configuration.

Titan reads all runtime configuration from environment variables (see
.env.example). Every service (ingestion, retrieval, telemetry, etc.) pulls
its settings from a single `Settings` instance so behavior stays consistent
across the platform and is trivially overridable per-environment
(dev / staging / prod) or per-tenant in future multi-tenant deployments.
"""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "staging", "production"] = "development"
    app_name: str = "Titan"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/v1"

    # Data stores
    postgres_dsn: str = "postgresql+asyncpg://titan:titan@localhost:5432/titan"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"

    # Auth — tokens
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Auth — rate limiting
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_minutes: int = 10
    login_lockout_minutes: int = 15

    # CORS — must be the real deployed frontend origin in production
    cors_origin: str = "http://localhost:3000"

    # Observability
    otel_exporter_otlp_endpoint: str | None = None

    # LLM routing
    default_llm_provider: str = "anthropic"
    default_model: str = "claude-3-5-sonnet-20241022"
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"

    # Retrieval defaults — tunable per experiment via the Experiment
    # Management service without redeploying.
    default_chunk_strategy: str = "recursive"
    default_embedding_model: str = "bge-base-en-v1.5"
    default_top_k: int = 20
    default_rerank_top_n: int = 6

    # Default collection name
    default_collection: str = "default"


@lru_cache
def get_settings() -> Settings:
    return Settings()
