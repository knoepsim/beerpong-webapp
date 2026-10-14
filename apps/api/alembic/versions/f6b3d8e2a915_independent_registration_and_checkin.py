"""registration and check-in as independent switches with optional automation

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
    op.add_column('tournaments', sa.Column('registration_is_open', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('tournaments', sa.Column('registration_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tournaments', sa.Column('registration_auto_close', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('tournaments', sa.Column('checkin_is_open', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('tournaments', sa.Column('checkin_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tournaments', sa.Column('checkin_auto_open', sa.Boolean(), server_default='false', nullable=False))

    # Keep what the old rules did: the registration closed at its deadline, check-in opened at its own time or with
    # the end of the registration, and without any time it was open right away.
    op.execute(
        """
        UPDATE tournaments SET
            registration_auto_close = registration_end_time IS NOT NULL,
            checkin_start_time = CASE
                WHEN checkin_enabled THEN COALESCE(checkin_start_time, registration_end_time)
                ELSE NULL
            END
        """
    )
    op.execute(
        """
        UPDATE tournaments SET
            checkin_auto_open = checkin_enabled AND checkin_start_time IS NOT NULL,
            checkin_is_open = checkin_enabled AND checkin_start_time IS NULL AND started_at IS NULL,
            registration_is_open = started_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column('tournaments', 'checkin_auto_open')
    op.drop_column('tournaments', 'checkin_changed_at')
    op.drop_column('tournaments', 'checkin_is_open')
    op.drop_column('tournaments', 'registration_auto_close')
    op.drop_column('tournaments', 'registration_changed_at')
    op.drop_column('tournaments', 'registration_is_open')
