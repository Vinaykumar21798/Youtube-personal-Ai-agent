"""Add extra_metadata column to conversation_messages

Revision ID: 005_message_extra_metadata
Revises: 004_conversations_and_messages
Create Date: 2026-10-13 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_message_extra_metadata'
down_revision: Union[str, None] = '004_conversations_and_messages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'conversation_messages',
        sa.Column('extra_metadata', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('conversation_messages', 'extra_metadata')
