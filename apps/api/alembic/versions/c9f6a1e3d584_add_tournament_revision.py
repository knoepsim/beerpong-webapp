"""add tournament revision

Revision ID: c9f6a1e3d584
Revises: b8e5f0d2c473
Create Date: 2026-10-15 15:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f6a1e3d584'
down_revision: str | Sequence[str] | None = 'b8e5f0d2c473'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('tournaments', sa.Column('revision', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('tournaments', 'revision')
