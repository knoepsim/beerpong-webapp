"""The short, readable address of a tournament: /t/{slug}. It is an address, not a secret."""
import re
import secrets
import unicodedata

from app.core.exceptions import InvalidSlugError

MIN_LENGTH = 3
MAX_LENGTH = 40
# Words that are routes of the app and must not become a tournament address
RESERVED = frozenset(
    {"new", "me", "admin", "api", "login", "logout", "invite", "t", "tournaments", "teams", "profile", "onboarding"}
)
_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_GERMAN = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "Ä": "ae", "Ö": "oe", "Ü": "ue"})
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alikes (0/o, 1/l/i)


def slugify(text: str) -> str:
    """"Sommerfest 2026!" -> "sommerfest-2026" (umlauts spelled out, cut at the last word that fits)."""
    ascii_text = unicodedata.normalize("NFKD", text.translate(_GERMAN)).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    if len(slug) > MAX_LENGTH:
        slug = slug[:MAX_LENGTH].rsplit("-", 1)[0] if "-" in slug[:MAX_LENGTH] else slug[:MAX_LENGTH]
    if len(slug) < MIN_LENGTH:
        slug = f"{slug}-turnier".strip("-")
    if slug in RESERVED:
        slug = f"{slug}-turnier"
    return slug


def random_slug(length: int = 7) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def normalize_slug(value: str) -> str:
    """A slug the organizer typed: lower case, only a-z 0-9 and single hyphens, 3-40 characters, not reserved."""
    slug = value.strip().lower()
    if not MIN_LENGTH <= len(slug) <= MAX_LENGTH:
        raise InvalidSlugError(f"Die Adresse muss {MIN_LENGTH} bis {MAX_LENGTH} Zeichen lang sein.")
    if not _PATTERN.match(slug):
        raise InvalidSlugError("Die Adresse darf nur Kleinbuchstaben, Ziffern und einzelne Bindestriche enthalten.")
    if slug in RESERVED:
        raise InvalidSlugError("Diese Adresse ist für die App reserviert.")
    return slug
