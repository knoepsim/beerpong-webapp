from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/beerpong"

    # JWT
    secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    access_token_expire_minutes: int = 43200
    refresh_token_expire_days: int = 30

    # SMS Verification
    sms_code_expire_minutes: int = 5
    sms_code_length: int = 6

    # Abuse protection for SMS codes
    sms_resend_cooldown_seconds: int = 60
    sms_max_requests_per_hour: int = 5
    sms_max_verify_attempts: int = 5

    # Set ENVIRONMENT=production to refuse insecure defaults (dummy SMS, default secret key)
    environment: str = "development"

    # SMS Backend: "dummy" (v1) or "httpsms" (future)
    sms_backend: str = "dummy"

    # System Admin
    super_admin_phones: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


    @model_validator(mode="after")
    def _reject_insecure_production_config(self) -> "Settings":
        if self.environment != "production":
            return self
        problems = []
        if self.sms_backend == "dummy":
            problems.append("SMS_BACKEND must not be 'dummy' (fixed code 123456, codes are logged)")
        if self.secret_key == "CHANGE-ME-IN-PRODUCTION":
            problems.append("SECRET_KEY must be changed")
        if problems:
            raise ValueError("Insecure production configuration: " + "; ".join(problems))
        return self


settings = Settings()
