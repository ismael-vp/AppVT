import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Settings(BaseSettings):
    """
    Configuración centralizada y validada.
    FastAPI fallará en el arranque (Crash Early) si falta alguna clave secreta obligatoria.
    """
    ENVIRONMENT: str = "development"

    ALLOWED_ORIGINS: list[str] | str = [
        "http://localhost:3000",
        "https://phishscanner-iu6g.onrender.com"
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip().rstrip('/') for origin in v.split(",") if origin.strip()]
        return [origin.rstrip('/') for origin in v]

    ADMIN_SECRET_KEY: str
    OPENAI_API_KEY: str

    ABUSEIPDB_API_KEY: str | None = None
    GOOGLE_SAFE_BROWSING_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
