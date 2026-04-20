from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "BillboardHub API"
    app_env: str = "development"
    app_mode_default: str = "auth"
    allowed_origins: str = "http://localhost:3000"

    # For local development we default to SQLite. In production use Supabase Postgres.
    database_url: str = "sqlite+aiosqlite:///./billboardhub.db"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Supabase Auth JWT secret (optional in local dev).
    supabase_jwt_secret: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
