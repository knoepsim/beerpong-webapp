"use client";

import { useMemo, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MatchRow } from "@/components/match-row";
import { STATUS_ICONS } from "@/components/status-icons";
import { useNow } from "@/hooks/use-now";
import { JoinTournament } from "@/components/join-tournament";
import { allMatchSlots, buildBracketLayout } from "@/lib/bracket-layout";
import { formatWhen } from "@/lib/format-when";
import { statusBeforeStart, statusInBracket, type MyStatus, type StatusTone } from "@/lib/my-status";
import { JoinPolicy, type Bracket, type Team, type Tournament, type TournamentTeam } from "@/types";


/** The tone as the variant of the alert; the sentence says the same in words (never color alone). */
const VARIANTS: Record<StatusTone, "error" | "warning" | "info" | "default" | "success"> = {
  urgent: "error",
  attention: "warning",
  active: "info",
  relaxed: "default",
  done: "success",
};

function StatusCard({
  status,
  compact = false,
  children,
}: Readonly<{ status: MyStatus; compact?: boolean; children?: ReactNode }>) {
  const Icon = STATUS_ICONS[status.icon];
  return (
    // a lasting state, announced politely (not role="alert", which interrupts)
    <Alert variant={VARIANTS[status.tone]} role="status" className={compact ? "gap-x-2 rounded-xl px-3 py-2" : "gap-x-3 rounded-xl px-4 py-3"}>
      <Icon className={compact ? "size-4" : "size-5"} aria-hidden="true" />
      <AlertTitle className="font-semibold leading-snug text-balance">{status.title}</AlertTitle>
      {!compact && status.detail && <AlertDescription>{status.detail}</AlertDescription>}
      {!compact && children && <div className="col-span-full mt-3 space-y-2">{children}</div>}
    </Alert>
  );
}

interface ParticipantStatusProps {
  tournament: Tournament;
  /** My team in this tournament, if I take part. */
  team: TournamentTeam | null;
  bracket: Bracket | null;
  teamsMap: Record<string, Team>;
  /** Organizers without a team get no join card: they have their own controls. */
  canManage: boolean;
  slug: string;
  onLeave: () => void;
  /** One line only (on the other tabs): the sentence stays, details, match and actions are on the overview. */
  compact?: boolean;
}

/**
 * The first thing a participant sees, in every phase at the same place: one sentence about what is going on and
 * what to do now, colored by urgency, with the match it is about and the one action that fits (join or leave).
 */
export function ParticipantStatus({
  tournament,
  team,
  bracket,
  teamsMap,
  canManage,
  slug,
  onLeave,
  compact = false,
}: Readonly<ParticipantStatusProps>) {
  const slots = useMemo(() => (bracket ? allMatchSlots(buildBracketLayout(bracket)) : []), [bracket]);
  const now = useNow();

  if (!team) {
    if (!tournament.registration_open || canManage) return null;
    const invite = tournament.join_policy !== JoinPolicy.OPEN;
    return (
      <StatusCard
        status={{
          tone: "relaxed",
          icon: "join",
          title: "Die Anmeldung ist offen.",
          detail: invite
            ? "Beitreten kannst du nur mit einem Einladungslink vom Veranstalter."
            : tournament.registration_end_time && tournament.registration_auto_close
              ? `Anmeldeschluss ${formatWhen(tournament.registration_end_time)}.`
              : null,
        }}
      >
        {!invite && (
          <JoinTournament tournamentId={tournament.id} tournamentName={tournament.name} loginRedirect={`/t/${slug}`} />
        )}
      </StatusCard>
    );
  }

  const status = tournament.started_at
    ? bracket && statusInBracket(slots, bracket.total_rounds, team, teamsMap, bracket.champion_team_id, now)
    : statusBeforeStart(tournament, team);
  if (!status) return null;

  return (
    <StatusCard status={status} compact={compact}>
      {status.slot && <MatchRow slot={status.slot} teamsMap={teamsMap} highlightTeamId={team.id} />}
      {tournament.registration_open && (
        <Button variant="ghost" size="sm" onClick={onLeave} className="-ml-2 gap-1.5 text-muted-foreground">
          <LogOut className="size-4" aria-hidden="true" />
          Turnier verlassen
        </Button>
      )}
    </StatusCard>
  );
}
