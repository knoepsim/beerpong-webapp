"""a result is the score of both teams (score_a, score_b) instead of the cups the winner had left; football as a game

Revision ID: e7c3b9a4d215
Revises: d2f7a1c9e384
Create Date: 2026-10-21 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7c3b9a4d215'
down_revision: str | Sequence[str] | None = 'd2f7a1c9e384'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE game ADD VALUE IF NOT EXISTS 'FOOTBALL'")
    op.add_column('results', sa.Column('score_a', sa.Integer(), nullable=True))
    op.add_column('results', sa.Column('score_b', sa.Integer(), nullable=True))
    # beer pong so far: the winner kept its cups (all 10 when none were entered), the loser had none
    op.execute(
        """
        UPDATE results r SET
            score_a = CASE WHEN r.winner_team_id = m.team_a_id THEN COALESCE(r.cups_left, 10) ELSE 0 END,
            score_b = CASE WHEN r.winner_team_id = m.team_b_id THEN COALESCE(r.cups_left, 10) ELSE 0 END
        FROM matches m
        WHERE r.match_id = m.id AND r.winner_team_id IS NOT NULL
        """
    )
    op.drop_column('results', 'cups_left')


def downgrade() -> None:
    op.add_column('results', sa.Column('cups_left', sa.Integer(), nullable=True))
    op.execute("UPDATE results SET cups_left = GREATEST(score_a, score_b) WHERE score_a IS NOT NULL")
    op.drop_column('results', 'score_b')
    op.drop_column('results', 'score_a')
    # a value of an enum type cannot be dropped in PostgreSQL: 'FOOTBALL' stays in the type
