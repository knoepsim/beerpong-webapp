"""add tournament slug (the address /t/{slug})

Revision ID: a7d4e9c1b362
Revises: f6b3d8e2a915
Create Date: 2026-10-15 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.core.slug import MAX_LENGTH, slugify


# revision identifiers, used by Alembic.
revision: str = 'a7d4e9c1b362'
down_revision: Union[str, Sequence[str], None] = 'f6b3d8e2a915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tournaments', sa.Column('slug', sa.String(length=40), nullable=True))

    # every tournament gets its title as address, with a number if it is taken (oldest keeps the plain one)
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, name FROM tournaments ORDER BY created_at, id")).fetchall()
    taken: set[str] = set()
    for row in rows:
        base = slugify(row.name)
        candidate, n = base, 1
        while candidate in taken:
            n += 1
            suffix = f"-{n}"
            candidate = f"{base[: MAX_LENGTH - len(suffix)].rstrip('-')}{suffix}"
        taken.add(candidate)
        connection.execute(sa.text("UPDATE tournaments SET slug = :slug WHERE id = :id"), {"slug": candidate, "id": row.id})

    op.alter_column('tournaments', 'slug', nullable=False)
    op.create_index(op.f('ix_tournaments_slug'), 'tournaments', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_tournaments_slug'), table_name='tournaments')
    op.drop_column('tournaments', 'slug')
