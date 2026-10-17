"use client";

import { Calendar, MapPin, Share2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format-when";
import { shareOrCopy } from "@/lib/share";
import { phaseLabel } from "@/lib/tournament-phase";
import { JoinPolicy, type Tournament } from "@/types";

/** Name, phase, when, where and how many teams: what a tournament is, at a glance. */
export function TournamentHeader({ tournament, teamCount }: Readonly<{ tournament: Tournament; teamCount: number }>) {
  // the plain address, without whatever is in the address bar (an invitation, a tab)
  const share = () =>
    shareOrCopy({ title: tournament.name, url: `${window.location.origin}/t/${tournament.slug}` }, "Turnier-Link kopiert.");

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tournament.name}</h1>
        {tournament.join_policy === JoinPolicy.OPEN && (
          <Button variant="ghost" size="icon" onClick={share} className="size-9" aria-label={`${tournament.name} teilen`}>
            <Share2 className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Badge variant={tournament.phase === "running" ? "default" : "secondary"}>{phaseLabel(tournament.phase)}</Badge>
        {tournament.start_time && (
          <span className="flex items-center gap-1">
            <Calendar className="size-4" aria-hidden="true" />
            {formatWhen(tournament.start_time)}
          </span>
        )}
        {tournament.location && (
          <span className="flex items-center gap-1">
            <MapPin className="size-4" aria-hidden="true" />
            {tournament.location}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Users className="size-4" aria-hidden="true" />
          {teamCount === 1 ? "1 Team" : `${teamCount} Teams`}
        </span>
      </div>
    </div>
  );
}
