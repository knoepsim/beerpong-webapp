"""what a tournament plays: game per tournament (beer pong for all existing ones)

Revision ID: d2f7a1c9e384
Revises: c4a9e2f7b153
Create Date: 2026-10-20 18:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd2f7a1c9e384'
down_revision: str | Sequence[str] | None = 'c4a9e2f7b153'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    game = postgresql.ENUM('BEERPONG', name='game')
    game.create(op.get_bind(), checkfirst=True)
    # every tournament so far was beer pong; new ones choose (no default in the API)
    op.add_column(
        'tournaments',
        sa.Column('game', postgresql.ENUM('BEERPONG', name='game', create_type=False), server_default='BEERPONG', nullable=False),
    )
    op.alter_column('tournaments', 'game', server_default=None)


def downgrade() -> None:
    op.drop_column('tournaments', 'game')
    op.execute("DROP TYPE game")
