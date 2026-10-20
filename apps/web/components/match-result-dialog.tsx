"use client";

import { useState } from "react";
import { currentResult, useDeleteResult, useMatchResults, useSaveResult, useSetMatchStarted } from "@/hooks/queries/matches";
import { errorMessage } from "@/lib/errors";
import { LoadError } from "@/components/load-error";
import { Spinner } from "@/components/ui/spinner";
import type { Game, Match, ReportedResult, Result } from "@/types";
import { ResultType } from "@/types";
import { History, MapPin, Play, Timer, Undo2 } from "lucide-react";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { formatWhen } from "@/lib/format-when";
import { GAMES, sameResult, type GameDefinition, type TeamBasic } from "@/components/games";
import { scoreText } from "@/lib/match-display";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MatchResultDialogProps {
  tournamentId: string;
  /** What is played: it decides the picture and the score that is entered. */
  game: Game;
  match: Match;
  teamA: TeamBasic;
  teamB: TeamBasic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const timeOf = (iso: string) => TIME.format(new Date(iso));

/**
 * The organization's view of a match: start it at its station (or take the start back) and report its result.
 * A result can always be reported, also without a start. The game brings the picture and the score.
 */
export function MatchResultDialog({ tournamentId, game, match, teamA, teamB, open, onOpenChange }: Readonly<MatchResultDialogProps>) {
  const resultsQuery = useMatchResults(match.id, { enabled: open });
  // a result in the next match locks this one: its winner plays there already
  const nextResultsQuery = useMatchResults(match.next_match_id, { enabled: open });
  const isLoading = resultsQuery.isPending || (!!match.next_match_id && nextResultsQuery.isPending);
  const loadError = resultsQuery.error ?? nextResultsQuery.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-md">
        <MatchHeader match={match} teamA={teamA} teamB={teamB} />
        <Separator />
        {loadError && (
          // without the history the form could overwrite a result it does not know
          <LoadError
            error={loadError}
            fallback="Das Ergebnis konnte nicht geladen werden."
            onRetry={() => {
              void resultsQuery.refetch();
              void nextResultsQuery.refetch();
            }}
          />
        )}
        {!loadError && isLoading && (
          <div className="flex justify-center p-4">
            <Spinner className="size-6 text-primary" />
          </div>
        )}
        {!loadError && !isLoading && (
          // keyed: a result that arrives later (another device) starts the form again from it
          <ResultForm
            key={currentResult(resultsQuery.data)?.id ?? "new"}
            tournamentId={tournamentId}
            game={GAMES[game]}
            match={match}
            teamA={teamA}
            teamB={teamB}
            results={resultsQuery.data ?? []}
            locked={!!currentResult(nextResultsQuery.data)}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MatchHeader({ match, teamA, teamB }: Readonly<{ match: Match; teamA: TeamBasic; teamB: TeamBasic }>) {
  return (
    <DialogHeader className="space-y-3">
      <DialogTitle className="sr-only">Ergebnis eintragen</DialogTitle>

      {/* Status and station of an open match */}
      {match.status !== "finished" && (
        <div className="flex items-center justify-center gap-2">
          <MatchStatusBadge match={match} className="text-xs" />
          {match.station_name && (match.status === "ready" || match.status === "live") && (
            <Badge variant="outline" className="text-xs gap-1 font-normal text-muted-foreground">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              {match.station_name}
            </Badge>
          )}
        </div>
      )}

      {/* VS Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="font-semibold text-sm truncate">{teamA.name}</span>
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          </div>
        </div>

        {/* no score here: the result input of the game below shows it */}
        <span className="shrink-0 text-xs text-muted-foreground">gegen</span>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
            <span className="font-semibold text-sm truncate">{teamB.name}</span>
          </div>
        </div>
      </div>
    </DialogHeader>
  );
}

function ResultForm({
  tournamentId,
  game,
  match,
  teamA,
  teamB,
  results,
  locked,
  onDone,
}: Readonly<{
  tournamentId: string;
  game: GameDefinition;
  match: Match;
  teamA: TeamBasic;
  teamB: TeamBasic;
  /** All entries of the match, oldest first. */
  results: Result[];
  /** The next match has a result already. */
  locked: boolean;
  onDone: () => void;
}>) {
  const nextMatchId = match.next_match_id;
  const existingResult = currentResult(results);
  const nextMatchHasResult = locked;
  const setStarted = useSetMatchStarted(tournamentId);
  const save = useSaveResult(tournamentId, match.id);
  const remove = useDeleteResult(tournamentId, match.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saved = toReported(existingResult);
  // what the game's input gives: null while it is not complete
  const [entry, setEntry] = useState<ReportedResult | null>(saved);
  const isStarting = setStarted.isPending;
  const isSubmitting = save.isPending;
  const isDeleting = remove.isPending;
  const failed = save.error ?? remove.error;
  const error = failed ? errorMessage(failed) : null;

  const handleSubmit = () => {
    if (!entry) return;
    save.mutate({ ...entry, existing: !!existingResult }, { onSuccess: onDone });
  };

  const changeStart = (start: boolean) => setStarted.mutate({ match, started: start }, { onSuccess: onDone });

  const handleDelete = () => remove.mutate(undefined, { onSuccess: onDone });

  const hasChanges = !sameResult(entry, saved);

  const savedWinner = existingResult?.winner_team_id === teamA.id ? teamA.name : teamB.name;
  const deleteConsequence = nextMatchId
    ? `${savedWinner} wird aus dem nächsten Spiel wieder entfernt, das Spiel ist wieder offen.`
    : "Das Finale ist wieder offen, das Turnier gilt nicht mehr als beendet.";

  let submitLabel = existingResult ? "Ergebnis ändern" : "Ergebnis speichern";
  if (isSubmitting) submitLabel = "Wird gespeichert…";

  const isValid = entry !== null;

  return (
    <div>
      {/* Start at the station: only for a match at its station; a live one can take the start back */}
      <StartControls match={match} isStarting={isStarting} onChange={changeStart} />

      {results.length > 0 && <ResultHistory results={results} teamA={teamA} teamB={teamB} />}

      {/* Lock warning */}
      {nextMatchHasResult && existingResult && (
        <div className="bg-destructive/10 p-3 rounded-md text-sm mb-3 border border-destructive/20 text-destructive">
          <p className="font-semibold">Bearbeiten gesperrt</p>
          <p className="mt-1">
            Für das darauffolgende Spiel liegt bereits ein Ergebnis vor. Bitte lösche zuerst das Ergebnis des Folgespiels.
          </p>
        </div>
      )}

      <game.ResultInput teamA={teamA} teamB={teamB} initial={saved} locked={nextMatchHasResult} onChange={setEntry} />

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-6">
        <div className="flex gap-2 w-full">
          <Button type="button" variant="outline" onClick={onDone} className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || !hasChanges || isSubmitting || nextMatchHasResult} className="flex-1">
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* deleting is far from the primary action and asks first, naming what happens */}
      {existingResult && !nextMatchHasResult && (
        <div className="mt-6 flex flex-col gap-3">
          <Separator />
          {confirmDelete ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium">Ergebnis löschen?</p>
              <p className="text-muted-foreground">{deleteConsequence}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
                  Abbrechen
                </Button>
                <Button type="button" variant="destructive" className="flex-1" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Wird gelöscht…" : "Ergebnis löschen"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-destructive hover:text-destructive"
            >
              Ergebnis löschen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StartControls({
  match,
  isStarting,
  onChange,
}: Readonly<{ match: Match; isStarting: boolean; onChange: (started: boolean) => void }>) {
  if (match.status === "ready") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange(true)}
        disabled={isStarting}
        className="w-full h-11 mb-3 gap-2 border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/50"
      >
        <Play className="w-4 h-4 fill-current" aria-hidden="true" />
        {isStarting ? "Wird gestartet…" : "Spiel starten"}
      </Button>
    );
  }
  if (match.status !== "live") return null;
  return (
    <div className="mb-3 flex items-center justify-between gap-2 text-sm">
      {match.started_at && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Timer className="w-4 h-4" aria-hidden="true" />
          seit {timeOf(match.started_at)} Uhr
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(false)}
        disabled={isStarting}
        className="gap-1.5 text-muted-foreground"
      >
        <Undo2 className="w-4 h-4" aria-hidden="true" />
        Start zurücknehmen
      </Button>
    </div>
  );
}

/** Who reported what and when, closed until asked for. */
function ResultHistory({ results, teamA, teamB }: Readonly<{ results: Result[]; teamA: TeamBasic; teamB: TeamBasic }>) {
  const [open, setOpen] = useState(false);
  const nameOf = (id: string | null) => [teamA, teamB].find((team) => team.id === id)?.name ?? "Unbekannt";
  return (
    <div className="mb-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="w-full text-muted-foreground flex justify-between items-center bg-muted/20 hover:bg-muted/40"
      >
        <span>{open ? "Verlauf ausblenden" : "Verlauf anzeigen"}</span>
        <History className="w-4 h-4" />
      </Button>

      {open && (
        <div className="mt-2 space-y-2 max-h-[150px] overflow-y-auto pr-2 border rounded-md p-2 bg-muted/10 animate-in fade-in zoom-in-95 duration-200">
          {results.map((r) => (
            <div key={r.id} className="text-xs border-b last:border-0 pb-2 last:pb-0">
              <div className="flex justify-between text-muted-foreground">
                <span>{formatWhen(r.created_at)}</span>
                <span>{r.reported_by_username || "Unbekannt"}</span>
              </div>
              <div className="mt-1 font-medium">
                {r.type === ResultType.DELETED ? (
                  <span className="text-destructive">Ergebnis gelöscht</span>
                ) : (
                  <span>
                    {r.type === ResultType.CREATED ? "Gemeldet" : "Geändert"}: {nameOf(r.winner_team_id)}
                    {scoreText(r) ? ` (${scoreText(r)})` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A saved result as the inputs take it; null without one (or for a deletion). */
function toReported(result: Result | null | undefined): ReportedResult | null {
  if (!result?.winner_team_id || result.score_a == null || result.score_b == null) return null;
  return { winnerTeamId: result.winner_team_id, scoreA: result.score_a, scoreB: result.score_b };
}
