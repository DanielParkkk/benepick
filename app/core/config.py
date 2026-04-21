from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(default="local")
    database_url: str = Field(default="postgresql+psycopg://postgres:postgres@localhost:5432/benepick")

    gov24_service_key: str | None = Field(default=None)
    gov24_base_url: str = Field(default="https://api.odcloud.kr/api/gov24/v3")

    bokjiro_service_key: str | None = Field(default=None)
    bokjiro_base_url: str = Field(
        default="http://apis.data.go.kr/B554287/NationalWelfareInformationsV001"
    )

    request_timeout_seconds: int = Field(default=30)

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str | None) -> str | None:
        if not value:
            return value
        text = str(value).strip()
        if text.startswith("postgresql://"):
            return text.replace("postgresql://", "postgresql+psycopg://", 1)
        if text.startswith("postgres://"):
            return text.replace("postgres://", "postgresql+psycopg://", 1)
        return text


@lru_cache
def get_settings() -> Settings:
    return Settings()
