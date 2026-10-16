"""matches get a table of the tournament (planned), when they became ready and since when they are at a table

Revision ID: e1b8c3f5a2d7
Revises: d0a7b2e4f6c1
Create Date: 2026-10-16 14:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1b8c3f5a2d7'
down_revision: str | Sequence[str] | None = 'd0a7b2e4f6c1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('matches', sa.Column('table_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_matches_table_id', 'matches', 'tournament_tables', ['table_id'], ['id'], ondelete='SET NULL'
    )
    op.add_column('matches', sa.Column('ready_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('matches', sa.Column('on_table_at', sa.DateTime(timezone=True), nullable=True))
    # matches that can be played already count as ready since now; the tables follow with the next result
    op.execute("UPDATE matches SET ready_at = now() WHERE team_a_id IS NOT NULL AND team_b_id IS NOT NULL")
    op.drop_column('matches', 'table_number')


def downgrade() -> None:
    op.add_column('matches', sa.Column('table_number', sa.Integer(), nullable=True))
    op.drop_column('matches', 'on_table_at')
    op.drop_column('matches', 'ready_at')
    op.drop_constraint('fk_matches_table_id', 'matches', type_='foreignkey')
    op.drop_column('matches', 'table_id')
