"""The session of a request is committed before the response goes out (create, then load right away must work)."""
from pathlib import Path

from app.core.database import DbSession

APP = Path(__file__).resolve().parents[1] / "app"


def test_the_request_session_ends_before_the_response():
    assert DbSession.__metadata__[0].scope == "function"


def test_every_endpoint_uses_that_session():
    # a plain Depends(get_db) would end after the response and be a second session next to DbSession
    offenders = [str(p.relative_to(APP)) for p in APP.rglob("*.py") if "Depends(get_db)" in p.read_text(encoding="utf-8")]
    assert offenders == []
