"""Rules for the time settings of a tournament (registration, check-in, start)."""
from datetime import datetime

from app.core.exceptions import InvalidScheduleError
from app.models.tournament import _aware


def validate_schedule(
    start_time: datetime | None,
    registration_end_time: datetime | None,
    checkin_enabled: bool,
    checkin_start_time: datetime | None,
) -> None:
    """Registration deadline and check-in start lie before the start. They may overlap: late teams can still
    register while others already check in.

    The check-in time is only taken into account if check-in is enabled.
    """
    start = _aware(start_time)
    registration_end = _aware(registration_end_time)
    checkin_start = _aware(checkin_start_time) if checkin_enabled else None

    if registration_end and start and registration_end > start:
        raise InvalidScheduleError("Der Anmeldeschluss muss vor dem Turnierstart liegen.")
    if checkin_start and start and checkin_start > start:
        raise InvalidScheduleError("Der Check-in muss vor dem Turnierstart beginnen.")
