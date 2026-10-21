"""group stage and knock-out as a mode

Revision ID: b6d1f3a8c529
Revises: a3c5e7f9b142
Create Date: 2026-10-22 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b6d1f3a8c529'
down_revision: str | Sequence[str] | None = 'a3c5e7f9b142'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE tournamentmode ADD VALUE IF NOT EXISTS 'GROUPS_KNOCKOUT'")
    op.add_column('tournaments', sa.Column('group_count', sa.Integer(), nullable=True))
    op.add_column('tournaments', sa.Column('advance_per_group', sa.Integer(), nullable=True))
    op.add_column('tournaments', sa.Column('knockout_started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('matches', sa.Column('group_number', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('source_a', sa.String(8), nullable=True))
    op.add_column('matches', sa.Column('source_b', sa.String(8), nullable=True))


def downgrade() -> None:
    op.drop_column('matches', 'source_b')
    op.drop_column('matches', 'source_a')
    op.drop_column('matches', 'group_number')
    op.drop_column('tournaments', 'knockout_started_at')
    op.drop_column('tournaments', 'advance_per_group')
    op.drop_column('tournaments', 'group_count')
    # a value of an enum type cannot be dropped in PostgreSQL
