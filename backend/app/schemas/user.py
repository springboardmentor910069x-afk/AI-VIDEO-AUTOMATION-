import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


PUBLIC_REGISTRATION_ROLES = {
    UserRole.LEARNER,
    UserRole.EDUCATOR,
    UserRole.CONTENT_CREATOR,
}


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str | None = None


class UserCreate(UserBase):
    password: str

    # SECURITY: public registration must never assign the privileged
    # ADMINISTRATOR role. Only learner, educator and content_creator are
    # assignable here. The role is validated server-side against an explicit
    # allow-list; an unrecognised or privileged value is rejected outright so
    # a caller cannot self-escalate. Administrator is reserved for authorisation
    # by an admin via /users/{id}/role.
    role: UserRole = UserRole.LEARNER

    @field_validator("role")
    @classmethod
    def _restrict_public_role(cls, value: UserRole) -> UserRole:
        if value not in PUBLIC_REGISTRATION_ROLES:
            raise ValueError("That role is not available for registration")
        return value


class UserRead(UserBase):
    id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    full_name: str | None = None
    is_active: bool | None = None
