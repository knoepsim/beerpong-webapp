"use client";

import { useMemo, type ReactNode } from "react";
import {
  Award,
  CalendarClock,
  CircleCheck,
  Coffee,
  Hourglass,
  LogOut,
  MapPin,
  Play,
  TriangleAlert,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchRow } from "@/components/match-row";
import { useNow } from "@/hooks/use-now";
import { JoinTournament } from "@/components/join-tournament";
import { allMatchSlots, buildBracketLayout } from "@/lib/bracket-layout";
import { formatWhen } from "@/lib/format-when";
import { statusBeforeStart, statusInBracket, type MyStatus, type StatusIcon, type StatusTone } from "@/lib/my-status";
import { cn } from "@/lib/utils";
import { JoinPolicy, type Bracket, type Team, type Tournament, type TournamentTeam } from "@/types";

const ICONS: Record<StatusIcon, LucideIcon> = {
  go: MapPin,
  play: Play,
  queue: Hourglass,
  pause: Coffee,
  award: Award,
  trophy: Trophy,
  check: CircleCheck,
  alert: TriangleAlert,
  calendar: CalendarClock,
  join: UserPlus,
};

/** The tone as color of the card and its icon; the sentence says the same in words (never color alone). */
const TONES: Record<StatusTone, { card: string; icon: string }> = {
  urgent: { card: "border-destructive/60 bg-destructive/10", icon: "text-destructive" },
  attention: { card: "border-warning/60 bg-warning/10", icon: "text-warning" },
  active: { card: "border-primary/60 bg-primary/10", icon: "text-primary" },
  relaxed: { card: "", icon: "text-muted-foreground" },
  done: { card: "border-success/60 bg-success/10", icon: "text-success" },
};

function StatusCard({ status, children }: Readonly<{ status: MyStatus; children?: ReactNode }>) {
  const Icon = ICONS[status.icon];
  const tone = TONES[status.tone];
  return (
    <Card className={cn("border-l-4 py-4", tone.card)}>
      <CardContent className="space-y-3 px-4">
        <div className="flex gap-3" role="status">
          <Icon className={cn("mt-0.5 size-5 shrink-0", tone.icon)} aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold leading-snug text-balance">{status.title}</p>
            {status.detail && <p className="text-sm text-muted-foreground">{status.detail}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
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
  onJoined: () => void | Promise<void>;
  onLeave: () => void;
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
  onJoined,
  onLeave,
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
          <JoinTournament tournamentId={tournament.id} tournamentName={tournament.name} loginRedirect={`/t/${slug}`} onJoined={onJoined} />
        )}
      </StatusCard>
    );
  }

  const status = tournament.started_at
    ? bracket && statusInBracket(slots, bracket.total_rounds, team, teamsMap, bracket.champion_team_id, now)
    : statusBeforeStart(tournament, team);
  if (!status) return null;

  return (
    <StatusCard status={status}>
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
