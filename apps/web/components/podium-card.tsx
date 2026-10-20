import { Medal, Trophy } from "lucide-react";
import { Celebration } from "@/components/celebration";
import { Card, CardContent } from "@/components/ui/card";
import { podium } from "@/lib/podium";
import type { Bracket, Team } from "@/types";

/**
 * The end of a tournament as its high point: the winner big with the trophy, below the other places. Shown at the
 * top of the overview once the final has a result.
 */
export function PodiumCard({ bracket, teamsMap }: Readonly<{ bracket: Bracket; teamsMap: Record<string, Team> }>) {
  const places = podium(bracket);
  if (!places) return null;
  const name = (id: string) => teamsMap[id]?.name ?? "Unbekannt";
  const players = teamsMap[places.champion]?.members?.map((m) => m.name).join(" · ");

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <Celebration id={bracket.tournament_id} />
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Trophy className="size-12 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Turniersieger</p>
            <p className="font-heading text-2xl font-bold leading-tight break-words">{name(places.champion)}</p>
            {players && <p className="text-sm text-muted-foreground">{players}</p>}
          </div>
        </div>
        {(places.runnerUp || places.third.length > 0) && (
          <dl className="space-y-1.5 border-t pt-3 text-sm">
            {places.runnerUp && (
              <div className="flex items-center gap-2">
                <Medal className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <dt className="w-14 shrink-0 text-muted-foreground">Platz 2</dt>
                <dd className="min-w-0 font-medium">{name(places.runnerUp)}</dd>
              </div>
            )}
            {places.third.length > 0 && (
              <div className="flex items-center gap-2">
                <Medal className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <dt className="w-14 shrink-0 text-muted-foreground">Platz 3</dt>
                <dd className="min-w-0 font-medium">{places.third.map(name).join(" · ")}</dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
