from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://knowledgeos:knowledgeos_local_demo@localhost:5433/knowledgeos"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "knowledgeos"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    model_cache_dir: Path = Path("./storage/models")
    llm_provider: Literal["none", "openai", "ollama", "gemini"] = "none"
    llm_model: str = ""
    openai_api_key: str = Field(default="", repr=False)
    gemini_api_key: str = Field(default="", repr=False)
    allowed_llm_providers: list[Literal["none", "openai", "ollama", "gemini"]] = ["none", "gemini", "openai", "ollama"]
    provider_max_attempts: int = Field(default=3,ge=1,le=3)
    ollama_url: str = "http://localhost:11434"
    upload_dir: Path = Path("./storage/uploads")
    max_upload_mb: int = Field(default=10, ge=1, le=50)
    max_document_chars: int = Field(default=1_000_000, ge=1000, le=5_000_000)
    chunk_size: int = Field(default=900, ge=200, le=1000)
    chunk_overlap: int = Field(default=150, ge=0)
    default_top_k: int = Field(default=5, ge=1, le=10)
    default_score_threshold: float = Field(default=0.3, ge=0, le=1)
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:5173", "http://127.0.0.1:8080"]
    rate_limit_per_minute: int = Field(default=120, ge=1)
    auth_cookie_secure: bool = False  # HTTP loopback development; set True behind HTTPS.
    admin_session_hours: int = Field(default=8, ge=1, le=24)
    provider_timeout_seconds: int = Field(default=60, ge=1, le=180)

    @model_validator(mode="after")
    def valid_settings(self):
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        if self.embedding_model != "sentence-transformers/all-MiniLM-L6-v2" or self.embedding_dimension != 384:
            raise ValueError(
                "This collection schema supports sentence-transformers/all-MiniLM-L6-v2 (384 dimensions) only; migrate collection before changing models"
            )
        if self.llm_provider == "openai" and (not self.openai_api_key or not self.llm_model):
            raise ValueError("OPENAI_API_KEY and LLM_MODEL are required for openai")
        if self.llm_provider not in self.allowed_llm_providers:
            raise ValueError("The selected LLM provider is not allowed by the server")
        if self.llm_provider == "gemini" and (not self.gemini_api_key or not self.llm_model):
            raise ValueError("GEMINI_API_KEY and LLM_MODEL are required for gemini")
        if self.llm_provider == "ollama" and not self.llm_model:
            raise ValueError("LLM_MODEL is required for ollama")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
