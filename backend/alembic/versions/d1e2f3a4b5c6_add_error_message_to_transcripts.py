"""add error_message to transcripts

Revision ID: d1e2f3a4b5c6
Revises: b663b249c42d
Create Date: 2026-08-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = ('b663b249c42d', 'c458d9b298e9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('transcripts', sa.Column('error_message', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('transcripts', 'error_message')
