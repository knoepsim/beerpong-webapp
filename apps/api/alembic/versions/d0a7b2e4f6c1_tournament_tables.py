"""tables of a tournament as rows instead of a count

Revision ID: d0a7b2e4f6c1
Revises: c9f6a1e3d584
Create Date: 2026-10-16 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0a7b2e4f6c1'
down_revision: str | Sequence[str] | None = 'c9f6a1e3d584'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'tournament_tables',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tournament_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=40), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tournament_id', 'name', name='uq_tournament_table_name'),
    )
    op.create_index(op.f('ix_tournament_tables_tournament_id'), 'tournament_tables', ['tournament_id'])

    # every tournament gets as many tables as it had: "Tisch 1" ... "Tisch n" (at least one)
    op.execute(
        """
        INSERT INTO tournament_tables (id, tournament_id, name, position)
        SELECT gen_random_uuid(), t.id, 'Tisch ' || n, n
        FROM tournaments t, LATERAL generate_series(1, GREATEST(t.table_count, 1)) AS n
        """
    )
    op.drop_column('tournaments', 'table_count')


def downgrade() -> None:
    op.add_column('tournaments', sa.Column('table_count', sa.Integer(), server_default='1', nullable=False))
    op.execute(
        """
        UPDATE tournaments SET table_count = GREATEST(
            (SELECT count(*) FROM tournament_tables WHERE tournament_id = tournaments.id), 1)
        """
    )
    op.alter_column('tournaments', 'table_count', server_default=None)
    op.drop_index(op.f('ix_tournament_tables_tournament_id'), table_name='tournament_tables')
    op.drop_table('tournament_tables')
