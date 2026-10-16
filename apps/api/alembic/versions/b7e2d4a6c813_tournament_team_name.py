"""tournament_teams keep the name a team had when the tournament started

Revision ID: b7e2d4a6c813
Revises: e1b8c3f5a2d7
Create Date: 2026-10-17 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2d4a6c813'
down_revision: str | Sequence[str] | None = 'e1b8c3f5a2d7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('tournament_teams', sa.Column('team_name', sa.String(length=100), nullable=True))
    # tournaments that already started keep the names the teams have today
    op.execute(
        "UPDATE tournament_teams SET team_name = teams.name FROM teams, tournaments "
        "WHERE teams.id = tournament_teams.team_id AND tournaments.id = tournament_teams.tournament_id "
        "AND tournaments.started_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column('tournament_teams', 'team_name')
