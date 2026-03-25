"""
Uygulama konfigürasyonu — environment variables .env dosyasından okunur.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Uygulama ─────────────────────────────────────────────────────────── #
    APP_NAME: str = "BulutKlinik AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Veritabanı ───────────────────────────────────────────────────────── #
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/bulutklinik_ai"

    # ── OpenAI ───────────────────────────────────────────────────────────── #
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # ── Depolama ─────────────────────────────────────────────────────────── #
    UPLOAD_DIR: str = "uploads/photos"
    ANNOTATED_DIR: str = "uploads/annotated"
    MAX_UPLOAD_SIZE_MB: int = 10

    # ── CORS (C# backend portunu içerir) ─────────────────────────────────── #
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",    # Vite frontend
        "http://localhost:3000",
        "http://localhost:8080",    # C# API (Docker)
        "http://localhost:5000",    # C# API (local)
    ]

    # ── Güvenlik ─────────────────────────────────────────────────────────── #
    # C# backend'in aynı JWT secret'ını kullanır; token doğrulama burada yapılır.
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
