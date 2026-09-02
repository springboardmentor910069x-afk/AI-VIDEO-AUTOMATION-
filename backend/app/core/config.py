from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ClipMind AI"
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./clipmind.db"
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "clipmind"
    jwt_secret: str = Field(default="dev-secret-change-me")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    upload_dir: Path = Path("./uploads")
    max_upload_mb: int = 500
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    ai_provider: str = "groq"
    groq_api_key: str | None = None
    groq_transcription_model: str = "whisper-large-v3-turbo"
    groq_summary_model: str = "llama-3.3-70b-versatile"
    groq_tutor_model: str = "llama-3.3-70b-versatile"
    openai_api_key: str | None = None
    openai_summary_model: str = "gpt-4o-mini"
    openai_tutor_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8")

    @model_validator(mode="after")
    def normalize_database_urls(self) -> "Settings":
        if self.database_url.startswith(("mongodb://", "mongodb+srv://")):
            self.mongodb_url = self.database_url
            self.database_url = "sqlite+aiosqlite:///./clipmind.db"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
