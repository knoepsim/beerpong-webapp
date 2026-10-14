"""add tournament finished_at

Revision ID: e5a2c7d91b46
Revises: d4e8b1f0a7c3
Create Date: 2026-10-14 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a2c7d91b46'
down_revision: Union[str, None] = 'd4e8b1f0a7c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tournaments', sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))
    # Tournaments that are already over: the latest result of the final (the match without a successor)
    # is not a deletion
    op.execute(
        """
        UPDATE tournaments
        SET finished_at = latest.created_at
        FROM (
            SELECT DISTINCT ON (m.id) m.tournament_id, r.created_at, r.type::text AS type
            FROM matches m
            JOIN results r ON r.match_id = m.id
            WHERE m.next_match_id IS NULL
            ORDER BY m.id, r.created_at DESC
        ) AS latest
        WHERE tournaments.id = latest.tournament_id AND latest.type <> 'DELETED'
        """
    )


def downgrade() -> None:
    op.drop_column('tournaments', 'finished_at')
