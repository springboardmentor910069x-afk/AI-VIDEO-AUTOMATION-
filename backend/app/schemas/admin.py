import uuid

from pydantic import BaseModel

from app.models.user import UserRole


class UpdateRole(BaseModel):
    role: UserRole


class UserList(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    is_active: bool

    model_config = {
        "from_attributes": True
    }