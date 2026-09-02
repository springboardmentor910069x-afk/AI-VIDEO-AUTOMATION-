from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known-weak secrets that must never be accepted. These include placeholder
# values shipped in examples/docs and any value short enough to brute-force an
# HS256 signing key.
_INSECURE_SECRETS = {
    "change-me-in-production",
    "changeme",
    "secret",
    "secret_key",
    "super-secret-key",
    "clipmind_ai_super_secret_key_2026",
    "your-secret-key",
    "your-secret-key-here",
    "cl1pm1nd-secret-key",
}

# Minimum length enforced so the JWT HMAC key has enough entropy. 32 random
# bytes (token_hex(32)) is the documented recommendation.
_MIN_SECRET_LEN = 32


class Settings(BaseSettings):

    groq_api_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "ClipMind-AI"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    # SECURITY: DEBUG is disabled by default so /docs, /redoc and SQL echo are
    # never exposed unless an operator explicitly opts in.
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/clipmind"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/clipmind"

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MEDIA_TOKEN_EXPIRE_HOURS: int = 1

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    LOG_LEVEL: str = "INFO"

    WHISPER_MODEL_NAME: str = "base"

    # How often the stale-processing watchdog scans for jobs stuck in a
    # non-terminal state (transcripts / key moments / keywords / videos).
    RECOVERY_INTERVAL_SECONDS: int = 60

    @model_validator(mode="after")
    def _reject_insecure_secret_key(self) -> "Settings":
        if not self.SECRET_KEY:
            raise ValueError(
                "SECRET_KEY must be set to a strong, unique value. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        if self.SECRET_KEY.strip().lower() in _INSECURE_SECRETS:
            raise ValueError(
                "SECRET_KEY is set to a known-insecure placeholder value. "
                "Set a strong, unique SECRET_KEY."
            )
        if len(self.SECRET_KEY) < _MIN_SECRET_LEN:
            raise ValueError(
                "SECRET_KEY is too short and does not provide enough entropy "
                f"for an HS256 signing key (minimum {_MIN_SECRET_LEN} chars). "
                "Generate a strong key with: python -c \"import secrets; "
                "print(secrets.token_hex(32))\""
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
