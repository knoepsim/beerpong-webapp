from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/beerpong"

    # JWT
    secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # SMS Verification
    sms_code_expire_minutes: int = 5
    sms_code_length: int = 6

    # SMS Backend: "dummy" (v1) or "httpsms" (future)
    sms_backend: str = "dummy"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
