import re

# German mobile networks only: 015x, 0160, 0162, 0163, 017x.
# Everything else is rejected on purpose, in particular special-rate numbers
# (0137, 0180, 0900, 118xx, 032, 0700, ...), pager/M2M ranges (0164-0169) and foreign numbers.
# That keeps SMS inside the flat rate of a standard German mobile contract.
_GERMAN_MOBILE = re.compile(r"^\+49(15\d|16[023]|17\d)\d{7,8}$")

GERMAN_MOBILE_ONLY_MESSAGE = "Nur deutsche Handynummern (+49 15x, 16x, 17x) werden unterstützt."


def normalize_german_mobile(raw: str) -> str:
    """Normalize user input to E.164 and ensure it is a German mobile number.

    Accepts +49 151 ..., 0049 151 ..., 0151 ... and the common mistake +49 0151 ...
    Raises ValueError with a user-facing message otherwise.
    """
    cleaned = re.sub(r"[\s().\-/]", "", raw)
    if cleaned.startswith("00"):
        cleaned = "+" + cleaned[2:]
    elif cleaned.startswith("0"):
        cleaned = "+49" + cleaned[1:]
    if cleaned.startswith("+490"):
        cleaned = "+49" + cleaned[4:]

    if not _GERMAN_MOBILE.fullmatch(cleaned):
        raise ValueError(GERMAN_MOBILE_ONLY_MESSAGE)
    return cleaned
