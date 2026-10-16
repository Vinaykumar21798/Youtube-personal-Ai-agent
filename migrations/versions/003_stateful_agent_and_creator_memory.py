"""Add CreatorMemory table and checkpoint columns to AnalysisJob

Revision ID: 003_stateful_agent_and_creator_memory
Revises: 002_google_oauth_and_sessions
Create Date: 2026-10-13 16:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_stateful_agent_and_creator_memory'
down_revision: Union[str, None] = '002_google_oauth_and_sessions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter analysis_jobs table to support workflow state checkpointing and retry counters
    with op.batch_alter_table('analysis_jobs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('checkpoint_data', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False))

    # 2. Create creator_memories table
    op.create_table(
        'creator_memories',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workspace_id', sa.String(length=36), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('memory_type', sa.String(length=100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('structured_payload', sa.JSON(), nullable=False),
        sa.Column('source_job_id', sa.String(length=36), nullable=True),
        sa.Column('source_evidence_id', sa.String(length=36), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=False, default=1.0),
        sa.Column('verification_status', sa.String(length=50), nullable=False, default='verified_observation'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_creator_memories_workspace_id', 'creator_memories', ['workspace_id'])
    op.create_index('ix_creator_memories_category', 'creator_memories', ['category'])
    op.create_index('ix_creator_memories_memory_type', 'creator_memories', ['memory_type'])
    op.create_index('ix_creator_memories_source_job_id', 'creator_memories', ['source_job_id'])


def downgrade() -> None:
    op.drop_index('ix_creator_memories_source_job_id', table_name='creator_memories')
    op.drop_index('ix_creator_memories_memory_type', table_name='creator_memories')
    op.drop_index('ix_creator_memories_category', table_name='creator_memories')
    op.drop_index('ix_creator_memories_workspace_id', table_name='creator_memories')
    op.drop_table('creator_memories')

    with op.batch_alter_table('analysis_jobs', schema=None) as batch_op:
        batch_op.drop_column('retry_count')
        batch_op.drop_column('checkpoint_data')
