"""add sms verification failed_attempts

Revision ID: c3f1a9d27e54
Revises: 72baa1e5d10c
Create Date: 2026-10-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f1a9d27e54'
down_revision: Union[str, None] = '72baa1e5d10c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'sms_verifications',
        sa.Column('failed_attempts', sa.Integer(), server_default='0', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('sms_verifications', 'failed_attempts')
