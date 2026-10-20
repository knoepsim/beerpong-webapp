import { Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TournamentTeam } from "@/types";

interface TeamListProps {
  teams: TournamentTeam[];
  /** The team I play with in this tournament: shown first and marked. */
  myTeamId?: string;
  /** Check-in exists in this tournament and the tournament has not started yet. */
  showCheckin: boolean;
  checkinOpen: boolean;
  /** Organizers can check teams in and remove them before the start. */
  canManage: boolean;
  onCheckin: (team: TournamentTeam, checkedIn: boolean) => void;
  onRemove: (team: TournamentTeam) => void;
}

function CheckinControl({
  team,
  canManage,
  checkinOpen,
  onCheckin,
}: Readonly<Pick<TeamListProps, "canManage" | "checkinOpen" | "onCheckin"> & { team: TournamentTeam }>) {
  if (!canManage) {
    return team.is_checked_in ? (
      <Badge variant="success" className="shrink-0">
        <Check aria-hidden="true" />
        Eingecheckt
      </Badge>
    ) : null;
  }
  // a switch with two states: checked in or not (the organization toggles it at the door)
  return (
    <Toggle
      variant="outline"
      className="h-10 shrink-0 aria-pressed:border-success/60 aria-pressed:bg-success/10"
      pressed={team.is_checked_in}
      onPressedChange={(pressed) => onCheckin(team, pressed)}
      disabled={!checkinOpen}
      aria-label={`${team.name} ${team.is_checked_in ? "ist eingecheckt, Check-in zurücknehmen" : "einchecken"}`}
    >
      {team.is_checked_in ? (
        <>
          <Check data-icon="inline-start" aria-hidden="true" /> Eingecheckt
        </>
      ) : (
        "Einchecken"
      )}
    </Toggle>
  );
}

/** Teams of a tournament: name and players, plus check-in state; organizers get the actions in the same row. */
export function TournamentTeamList({
  teams,
  myTeamId,
  showCheckin,
  checkinOpen,
  canManage,
  onCheckin,
  onRemove,
}: Readonly<TeamListProps>) {
  const sorted = [...teams].sort((a, b) => Number(b.id === myTeamId) - Number(a.id === myTeamId));

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {sorted.map((team) => (
        <li key={team.id} className="flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate font-semibold">{team.name}</span>
              {team.id === myTeamId && <Badge className="shrink-0">Dein Team</Badge>}
            </p>
            <p className="text-sm text-muted-foreground">
              {team.members.map((m) => m.name).join(" · ")}
            </p>
          </div>

          {showCheckin && (
            <CheckinControl team={team} canManage={canManage} checkinOpen={checkinOpen} onCheckin={onCheckin} />
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemove(team)}
              aria-label={`Team ${team.name} entfernen`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
