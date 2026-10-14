"""add tournament checkin_opened_at

Revision ID: f6b3d8e2a915
Revises: e5a2c7d91b46
Create Date: 2026-10-14 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b3d8e2a915'
down_revision: Union[str, Sequence[str], None] = 'e5a2c7d91b46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tournaments', sa.Column('checkin_opened_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tournaments', 'checkin_opened_at')
