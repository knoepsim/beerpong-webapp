"""tables become stations: where a match is played is named by the game (Tisch, Platz)

Revision ID: f4a8d2c6b917
Revises: e7c3b9a4d215
Create Date: 2026-10-21 14:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f4a8d2c6b917'
down_revision: str | Sequence[str] | None = 'e7c3b9a4d215'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.rename_table('tournament_tables', 'stations')
    op.execute('ALTER INDEX ix_tournament_tables_tournament_id RENAME TO ix_stations_tournament_id')
    op.execute('ALTER TABLE stations RENAME CONSTRAINT uq_tournament_table_name TO uq_station_name')
    op.execute('ALTER TABLE stations RENAME CONSTRAINT tournament_tables_pkey TO stations_pkey')
    op.alter_column('matches', 'table_id', new_column_name='station_id')
    op.alter_column('matches', 'on_table_at', new_column_name='on_station_at')
    op.execute('ALTER TABLE matches RENAME CONSTRAINT fk_matches_table_id TO fk_matches_station_id')


def downgrade() -> None:
    op.execute('ALTER TABLE matches RENAME CONSTRAINT fk_matches_station_id TO fk_matches_table_id')
    op.alter_column('matches', 'on_station_at', new_column_name='on_table_at')
    op.alter_column('matches', 'station_id', new_column_name='table_id')
    op.execute('ALTER TABLE stations RENAME CONSTRAINT stations_pkey TO tournament_tables_pkey')
    op.execute('ALTER TABLE stations RENAME CONSTRAINT uq_station_name TO uq_tournament_table_name')
    op.execute('ALTER INDEX ix_stations_tournament_id RENAME TO ix_tournament_tables_tournament_id')
    op.rename_table('stations', 'tournament_tables')
