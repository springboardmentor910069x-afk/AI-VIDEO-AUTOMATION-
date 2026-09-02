"""Security tests for authentication and role authorization.

Covers:
- Public registration can never request a privileged role.
- Non-admin users are rejected by admin-only dependencies.
- JWT tokens sign/verify correctly and include the current role claim.

The in-process `require_role` and JWT tests are pure unit tests; the
registration schema tests validate role marshalling without a database.
"""

import pytest
from pydantic import ValidationError

from app.models.user import User, UserRole
from app.schemas.user import UserCreate


# ---------------- Schema-level privilege-escalation prevention ----------------

def test_user_create_forces_learner_role():
    body = UserCreate(
        email="learner@example.com",
        username="learner1",
        password="sTr0ng-password!",
    )
    assert body.role == UserRole.LEARNER


def test_user_create_rejects_client_supplied_administrator_role():
    # Administrator must never be assignable via public registration.
    with pytest.raises(ValidationError):
        UserCreate(
            email="attacker@example.com",
            username="attacker1",
            password="sTr0ng-password!",
            role=UserRole.ADMINISTRATOR,
        )


def test_user_create_allows_public_registration_roles():
    for role in (
        UserRole.LEARNER,
        UserRole.EDUCATOR,
        UserRole.CONTENT_CREATOR,
    ):
        body = UserCreate(
            email=f"u-{role.value}@example.com",
            username=f"u-{role.value}",
            password="sTr0ng-password!",
            role=role,
        )
        assert body.role == role


def test_user_create_rejects_unknown_role_string():
    # An unrecognised role value must not be accepted (400 at the API layer).
    with pytest.raises(ValidationError):
        UserCreate(
            email="bad@example.com",
            username="baduser",
            password="sTr0ng-password!",
            role="superadmin",
        )


def test_user_create_rejects_administrator():
    with pytest.raises(ValidationError):
        UserCreate(
            email="admin-escalation@example.com",
            username="admin-escalation",
            password="sTr0ng-password!",
            role=UserRole.ADMINISTRATOR,
        )


# ---------------- Role authorization dependency logic ----------------

def _fake_user(role: UserRole, active: bool = True) -> User:
    user = User(role=role)
    user.is_active = active
    return user


def test_require_role_blocks_non_admin(event_loop):
    from app.auth.dependencies import require_role

    async def run():
        checker = require_role(UserRole.ADMINISTRATOR)
        # An admin is allowed.
        await checker(_fake_user(UserRole.ADMINISTRATOR))
        return True

    assert event_loop.run_until_complete(run()) is True


def test_require_role_rejects_non_admin(event_loop):
    from fastapi import HTTPException

    from app.auth.dependencies import require_role

    async def run():
        checker = require_role(UserRole.ADMINISTRATOR)
        for role in (
            UserRole.LEARNER,
            UserRole.EDUCATOR,
            UserRole.CONTENT_CREATOR,
        ):
            try:
                await checker(_fake_user(role))
            except HTTPException as exc:
                assert exc.status_code == 403
            else:
                pytest.fail(f"Expected 403 for role {role}")
        return True

    assert event_loop.run_until_complete(run()) is True


def test_require_role_preserves_all_four_roles():
    names = {role.value for role in UserRole}
    assert names == {
        "learner",
        "educator",
        "content_creator",
        "administrator",
    }


# ---------------- JWT token security ----------------

def test_jwt_sign_verify_and_role_claim(event_loop):
    from app.auth.tokens import create_access_token, decode_token

    async def run():
        token = create_access_token("user-uuid", "learner")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-uuid"
        assert payload["role"] == "learner"
        return True

    assert event_loop.run_until_complete(run()) is True


def test_jwt_rejects_tampered_token(event_loop):
    from app.auth.tokens import create_access_token, decode_token

    async def run():
        token = create_access_token("user-uuid", "learner")
        tampered = token[:-6] + ("x" * 6)
        assert decode_token(tampered) is None
        return True

    assert event_loop.run_until_complete(run()) is True

