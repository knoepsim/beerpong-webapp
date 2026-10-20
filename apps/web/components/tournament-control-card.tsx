"use client";

import { Play } from "lucide-react";
import { CheckinSummary } from "@/components/checkin-summary";
import { PreparationControls } from "@/components/preparation-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planStart } from "@/lib/tournament-phase";
import type { Tournament, TournamentTeam } from "@/types";

/**
 * The organization's controls before the start (registration, check-in, start); while it runs where results go.
 * After the end there is nothing left to steer: the podium shows the outcome, so the card is gone.
 */
export function TournamentControlCard({
  tournament,
  teams,
  isStarting,
  onSetOpen,
  onStart,
}: Readonly<{
  tournament: Tournament;
  teams: TournamentTeam[];
  isStarting: boolean;
  onSetOpen: (kind: "registration" | "checkin", open: boolean) => void;
  onStart: () => void;
}>) {
  if (tournament.finished_at) return null;
  const plan = planStart(tournament, teams);
  return (
    <Card className="border-primary/50 bg-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-primary">
          <Play className="size-5" aria-hidden="true" />
          Turnier-Leitstand
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tournament.started_at ? (
          <p className="text-sm text-muted-foreground">Ergebnisse können im Spielplan eingetragen werden.</p>
        ) : (
          <>
            <PreparationControls
              tournament={tournament}
              onRegistration={(open) => onSetOpen("registration", open)}
              onCheckin={(open) => onSetOpen("checkin", open)}
            />
            {tournament.checkin_open && <CheckinSummary teams={teams} />}
            <Button onClick={onStart} disabled={isStarting || !plan.canStart} className="w-full sm:w-auto" size="lg">
              {isStarting ? "Wird gestartet…" : "Turnier starten"}
            </Button>
            {!plan.canStart && <p className="text-sm text-muted-foreground">{plan.description}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
