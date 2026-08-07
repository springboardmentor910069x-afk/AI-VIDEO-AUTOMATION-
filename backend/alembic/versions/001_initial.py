"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-01-01 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres Enum
    user_role_enum = postgresql.ENUM(
        "learner",
        "educator",
        "content_creator",
        "administrator",
        name="user_role",
    )
    user_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "email",
            sa.String(255),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "username",
            sa.String(100),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "hashed_password",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "full_name",
            sa.String(255),
            nullable=True,
        ),
        sa.Column(
            "role",
            postgresql.ENUM(
                "learner",
                "educator",
                "content_creator",
                "administrator",
                name="user_role",
                create_type=False,
            ),
            nullable=False,
            server_default="learner",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    user_role_enum = postgresql.ENUM(
        "learner",
        "educator",
        "content_creator",
        "administrator",
        name="user_role",
    )
    user_role_enum.drop(op.get_bind(), checkfirst=True)
