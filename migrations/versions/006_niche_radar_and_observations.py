"""Add video_observations and niche_search_caches tables

Revision ID: 006_niche_radar_and_observations
Revises: 005_message_extra_metadata
Create Date: 2026-10-13 19:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_niche_radar_and_observations'
down_revision: Union[str, None] = '005_message_extra_metadata'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. video_observations table
    op.create_table(
        'video_observations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('video_id', sa.String(length=50), nullable=False),
        sa.Column('channel_id', sa.String(length=100), nullable=True),
        sa.Column('channel_title', sa.String(length=255), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('niche_keyword', sa.String(length=255), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False),
        sa.Column('like_count', sa.Integer(), nullable=True),
        sa.Column('comment_count', sa.Integer(), nullable=True),
        sa.Column('observed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_video_observations_video_id', 'video_observations', ['video_id'])
    op.create_index('ix_video_observations_channel_id', 'video_observations', ['channel_id'])
    op.create_index('ix_video_observations_niche_keyword', 'video_observations', ['niche_keyword'])
    op.create_index('ix_video_observations_observed_at', 'video_observations', ['observed_at'])

    # 2. niche_search_caches table
    op.create_table(
        'niche_search_caches',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workspace_id', sa.String(length=36), nullable=False),
        sa.Column('niche_keyword', sa.String(length=255), nullable=False),
        sa.Column('time_period', sa.String(length=50), nullable=False, server_default='all'),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='most_viewed'),
        sa.Column('cached_payload', sa.JSON(), nullable=False),
        sa.Column('last_refreshed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_niche_search_caches_workspace_id', 'niche_search_caches', ['workspace_id'])
    op.create_index('ix_niche_search_caches_niche_keyword', 'niche_search_caches', ['niche_keyword'])


def downgrade() -> None:
    op.drop_table('niche_search_caches')
    op.drop_table('video_observations')
