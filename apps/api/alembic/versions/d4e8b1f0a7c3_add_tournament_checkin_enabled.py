"""add tournament checkin_enabled

Revision ID: d4e8b1f0a7c3
Revises: c3f1a9d27e54
Create Date: 2026-10-14 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e8b1f0a7c3'
down_revision: Union[str, None] = 'c3f1a9d27e54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tournaments',
        sa.Column('checkin_enabled', sa.Boolean(), server_default='false', nullable=False),
    )
    # Until now check-in was implied by a check-in start time: keep that behaviour for existing tournaments
    op.execute("UPDATE tournaments SET checkin_enabled = true WHERE checkin_start_time IS NOT NULL")


def downgrade() -> None:
    op.drop_column('tournaments', 'checkin_enabled')
