"""create keyword extraction tables

Revision ID: a1b2c3d4e5f6
Revises: d1e2f3a4b5c6
Create Date: 2026-08-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'keyword_sets',
        sa.Column('video_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('pending', 'processing', 'complete', 'failed', name='keyword_set_status'), nullable=False),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['video_id'], ['videos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_keyword_sets_status'), 'keyword_sets', ['status'], unique=False)
    op.create_index(op.f('ix_keyword_sets_video_id'), 'keyword_sets', ['video_id'], unique=True)

    op.create_table(
        'keywords',
        sa.Column('set_id', sa.UUID(), nullable=False),
        sa.Column('keyword', sa.String(length=255), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['set_id'], ['keyword_sets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_keywords_set_id'), 'keywords', ['set_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_index(op.f('ix_keywords_set_id'), table_name='keywords')
    op.drop_table('keywords')

    op.drop_index(op.f('ix_keyword_sets_video_id'), table_name='keyword_sets')
    op.drop_index(op.f('ix_keyword_sets_status'), table_name='keyword_sets')
    op.drop_table('keyword_sets')
    # ### end Alembic commands ###