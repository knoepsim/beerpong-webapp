"""personal invitations to a tournament; invitation links are deleted softly

Revision ID: c4a9e2f7b153
Revises: b7e2d4a6c813
Create Date: 2026-10-18 12:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4a9e2f7b153'
down_revision: str | Sequence[str] | None = 'b7e2d4a6c813'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUS = sa.Enum('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', name='invitationstatus')


def upgrade() -> None:
    op.add_column('tournament_invites', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'tournament_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('invite_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournament_invites.id'), nullable=True),
        sa.Column('invited_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('status', STATUS, nullable=False),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('tournament_id', 'user_id', name='uq_tournament_invitation_user'),
    )
    op.create_index('ix_tournament_invitations_tournament_id', 'tournament_invitations', ['tournament_id'])
    op.create_index('ix_tournament_invitations_user_id', 'tournament_invitations', ['user_id'])
    op.create_index('ix_tournament_invitations_invite_id', 'tournament_invitations', ['invite_id'])


def downgrade() -> None:
    op.drop_table('tournament_invitations')
    STATUS.drop(op.get_bind(), checkfirst=True)
    op.drop_column('tournament_invites', 'deleted_at')
