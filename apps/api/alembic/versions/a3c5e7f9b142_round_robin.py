"""everybody against everybody as a mode

Revision ID: a3c5e7f9b142
Revises: f4a8d2c6b917
Create Date: 2026-10-21 18:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a3c5e7f9b142'
down_revision: str | Sequence[str] | None = 'f4a8d2c6b917'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE tournamentmode ADD VALUE IF NOT EXISTS 'ROUND_ROBIN'")


def downgrade() -> None:
    # a value of an enum type cannot be dropped in PostgreSQL: tournaments in this mode would have to go first
    pass
