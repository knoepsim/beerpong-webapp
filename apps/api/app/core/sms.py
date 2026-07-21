import logging
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)


class SmsService(Protocol):
    """Protocol defining the SMS service interface.

    Implement this protocol to swap SMS backends without
    changing any calling code.
    """

    def send_code(self, phone_number: str, code: str) -> None:
        """Send a verification code to the given phone number."""
        ...


class DummySmsService:
    """Development SMS service that logs codes to the console."""

    def send_code(self, phone_number: str, code: str) -> None:
        logger.info("SMS [DUMMY] → %s: Your verification code is %s", phone_number, code)
        print(f"\n{'='*50}")
        print(f"  SMS → {phone_number}")
        print(f"  Code: {code}")
        print(f"{'='*50}\n")


def get_sms_service() -> SmsService:
    """Factory function returning the configured SMS service.

    Swap to a real implementation (e.g. HttpSmsSmsService) by
    changing the SMS_BACKEND environment variable.
    """
    if settings.sms_backend == "dummy":
        return DummySmsService()
    # Future: elif settings.sms_backend == "httpsms":
    #     return HttpSmsSmsService(api_key=settings.httpsms_api_key)
    raise ValueError(f"Unknown SMS backend: {settings.sms_backend}")
