"""tournament access: who sees results, who may join, invitation links

Revision ID: b8e5f0d2c473
Revises: a7d4e9c1b362
Create Date: 2026-10-15 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.core.slug import random_slug


# revision identifiers, used by Alembic.
revision: str = 'b8e5f0d2c473'
down_revision: Union[str, Sequence[str], None] = 'a7d4e9c1b362'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # visibility: public_listed and public_unlisted become "public"
    op.execute("ALTER TYPE tournamentvisibility RENAME VALUE 'PUBLIC_LISTED' TO 'PUBLIC'")
    op.execute("UPDATE tournaments SET visibility = 'PUBLIC' WHERE visibility::text = 'PUBLIC_UNLISTED'")

    # join policy: private tournaments were only open with the invite token, all others for everybody
    join_policy = postgresql.ENUM('OPEN', 'INVITE_ONLY', name='joinpolicy')
    join_policy.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'tournaments',
        sa.Column('join_policy', postgresql.ENUM('OPEN', 'INVITE_ONLY', name='joinpolicy', create_type=False),
                  server_default='OPEN', nullable=False),
    )
    op.execute("UPDATE tournaments SET join_policy = 'INVITE_ONLY' WHERE visibility::text = 'PRIVATE'")

    op.create_table(
        'tournament_invites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tournament_id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=7), nullable=False),
        sa.Column('label', sa.String(length=60), nullable=True),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tournament_invites_token'), 'tournament_invites', ['token'], unique=True)
    op.create_index(op.f('ix_tournament_invites_tournament_id'), 'tournament_invites', ['tournament_id'])
    op.add_column('tournament_teams', sa.Column('invite_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_tournament_teams_invite_id', 'tournament_teams', 'tournament_invites', ['invite_id'], ['id'], ondelete='SET NULL'
    )

    # every invite-only tournament gets a first link (the old long token cannot be kept, it is replaced by a short one)
    connection = op.get_bind()
    used: set[str] = set()
    for row in connection.execute(sa.text("SELECT id, created_by_id FROM tournaments WHERE join_policy = 'INVITE_ONLY'")):
        token = random_slug(7)
        while token in used:
            token = random_slug(7)
        used.add(token)
        connection.execute(
            sa.text(
                "INSERT INTO tournament_invites (id, tournament_id, token, created_by_id) "
                "VALUES (gen_random_uuid(), :tid, :token, :uid)"
            ),
            {"tid": row.id, "token": token, "uid": row.created_by_id},
        )

    op.drop_index('ix_tournaments_invite_token', table_name='tournaments')
    op.drop_column('tournaments', 'invite_token')


def downgrade() -> None:
    op.add_column('tournaments', sa.Column('invite_token', sa.String(length=64), nullable=True))
    op.create_index('ix_tournaments_invite_token', 'tournaments', ['invite_token'], unique=True)
    op.drop_constraint('fk_tournament_teams_invite_id', 'tournament_teams', type_='foreignkey')
    op.drop_column('tournament_teams', 'invite_id')
    op.drop_index(op.f('ix_tournament_invites_tournament_id'), table_name='tournament_invites')
    op.drop_index(op.f('ix_tournament_invites_token'), table_name='tournament_invites')
    op.drop_table('tournament_invites')
    op.drop_column('tournaments', 'join_policy')
    op.execute("DROP TYPE joinpolicy")
    op.execute("ALTER TYPE tournamentvisibility RENAME VALUE 'PUBLIC' TO 'PUBLIC_LISTED'")
