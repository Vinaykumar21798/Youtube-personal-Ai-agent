"""Add Google OAuth fields and UserSession table

Revision ID: 002_google_oauth_and_sessions
Revises: 001_initial_schema
Create Date: 2026-10-12 17:58:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_google_oauth_and_sessions'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter users table to support Google OAuth
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('hashed_password', existing_type=sa.String(length=255), nullable=True)
        batch_op.add_column(sa.Column('google_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('avatar_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('auth_provider', sa.String(length=50), server_default='local', nullable=False))
        batch_op.create_index('ix_users_google_id', ['google_id'], unique=True)

    # 2. Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(length=128), nullable=False),
        sa.Column('csrf_token', sa.String(length=128), nullable=False),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_session_token', 'user_sessions', ['session_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_user_sessions_session_token', table_name='user_sessions')
    op.drop_index('ix_user_sessions_user_id', table_name='user_sessions')
    op.drop_table('user_sessions')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_google_id')
        batch_op.drop_column('auth_provider')
        batch_op.drop_column('avatar_url')
        batch_op.drop_column('google_id')
        batch_op.alter_column('hashed_password', existing_type=sa.String(length=255), nullable=False)
