"use client";

import { CheckinSummary } from "@/components/checkin-summary";
import { TournamentTeamList } from "@/components/tournament-team-list";
import { InvitationsPanel } from "@/components/invitations-panel";
import { EmptyNote } from "@/components/empty-note";
import { Users } from "lucide-react";
import { formatWhen } from "@/lib/format-when";
import type { Tournament, TournamentTeam } from "@/types";

/** The teams of a tournament; before the start with the check-in and, for the organization, removing a team. */
export function TournamentTeamsTab({
  tournament,
  teams,
  myTeamId,
  canManage,
  onCheckin,
  onRemove,
}: Readonly<{
  tournament: Tournament;
  teams: TournamentTeam[];
  myTeamId?: string;
  canManage: boolean;
  onCheckin: (team: TournamentTeam, checkedIn: boolean) => void;
  onRemove: (team: TournamentTeam) => void;
}>) {
  const checkinBeforeStart = tournament.checkin_enabled && !tournament.started_at;
  const checkinStartsLater =
    checkinBeforeStart && !tournament.checkin_open && tournament.checkin_auto_open && !!tournament.checkin_start_time;

  const participantIds = new Set(teams.flatMap((team) => team.members.map((m) => m.user_id)));

  return (
    <div className="space-y-4">
      {/* inviting is work on the field of participants, only for the organization and only until the start */}
      {canManage && !tournament.started_at && (
        <InvitationsPanel tournamentId={tournament.id} participantIds={participantIds} />
      )}
      {checkinBeforeStart && teams.length > 0 && <CheckinSummary teams={teams} />}
      {checkinStartsLater && (
        <p className="text-sm text-muted-foreground">Der Check-in beginnt {formatWhen(tournament.checkin_start_time!)}.</p>
      )}
      {teams.length === 0 ? (
        <EmptyNote icon={Users} title="Noch keine Teams angemeldet" />
      ) : (
        <TournamentTeamList
          teams={teams}
          myTeamId={myTeamId}
          showCheckin={checkinBeforeStart}
          checkinOpen={tournament.checkin_open}
          canManage={canManage && !tournament.started_at}
          onCheckin={onCheckin}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
