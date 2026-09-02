"""Unit tests for application security configuration.

These validate the SECRET_KEY hardening and the DEBUG default without touching
the database. They construct `Settings` instances directly (bypassing the
cached environment-backed instance) so each case is fully isolated.
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

STRONG_KEY = "c1bc4a7768b2a1ad294b6a3c5c566fe717d76997697ee12b60d0e7f3f3a7717a"


def _settings(**overrides) -> Settings:
    base = {
        "SECRET_KEY": STRONG_KEY,
        "GROQ_API_KEY": "test-groq-key",
        "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
        "SYNC_DATABASE_URL": "sqlite:///:memory:",
    }
    base.update(overrides)
    return Settings(**base)


def test_debug_defaults_to_false():
    s = _settings()
    assert s.DEBUG is False


def test_strong_secret_key_is_accepted():
    s = _settings()
    assert s.SECRET_KEY == STRONG_KEY


def test_empty_secret_key_is_rejected():
    with pytest.raises(ValidationError):
        _settings(SECRET_KEY="")


def test_known_weak_secret_is_rejected():
    for weak in (
        "change-me-in-production",
        "secret",
        "changeme",
        "clipmind_ai_super_secret_key_2026",
    ):
        with pytest.raises(ValidationError):
            _settings(SECRET_KEY=weak)


def test_short_secret_key_is_rejected():
    with pytest.raises(ValidationError):
        _settings(SECRET_KEY="short-secret")


def test_debug_can_be_explicitly_enabled():
    s = _settings(DEBUG=True)
    assert s.DEBUG is True


# ---------------- Security response headers ----------------

def test_security_headers_present_on_responses():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.main import SecurityHeadersMiddleware

    hsc_app = FastAPI()

    @hsc_app.get("/ping")
    async def ping():
        return {"ok": True}

    hsc_app.add_middleware(SecurityHeadersMiddleware)

    with TestClient(hsc_app) as client:
        response = client.get("/ping")

    expected = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "referrer-policy": "strict-origin-when-cross-origin",
        "cross-origin-resource-policy": "same-origin",
        "cross-origin-opener-policy": "same-origin",
        "permissions-policy": (
            "camera=(), geolocation=(), microphone=(), "
            "payment=(), usb=(), sync-xhr=()"
        ),
        "strict-transport-security": "max-age=31536000; includeSubDomains",
    }
    for name, value in expected.items():
        assert response.headers.get(name) == value

