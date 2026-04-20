from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    app_name: str = "BillboardHub API"
    app_env: str = "development"
    app_mode_default: str = "auth"
    allowed_origins: str = "http://localhost:3000"

    # For local development we default to SQLite. In production use Supabase Postgres.
    database_url: str = "sqlite+aiosqlite:///./billboardhub.db"

    # Legacy OpenAI settings (kept for backward compatibility).
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # New multi-provider LLM settings.
    llm_primary_provider: str = "anthropic"
    llm_fallback_provider: str = "mistral"

    anthropic_api_key: str = ""
    anthropic_model_import: str = "claude-3-5-sonnet-latest"
    anthropic_model_hubert: str = "claude-3-5-sonnet-latest"

    mistral_api_key: str = ""
    mistral_model_import: str = "mistral-large-latest"
    mistral_model_hubert: str = "mistral-large-latest"

    # Supabase Auth JWT secret (optional in local dev).
    supabase_jwt_secret: str = ""

    # Import: when false, column mapping uses only local heuristics (no LLM / no row samples sent externally).
    import_use_llm: bool = Field(default=True, validation_alias="IMPORT_USE_LLM")

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
