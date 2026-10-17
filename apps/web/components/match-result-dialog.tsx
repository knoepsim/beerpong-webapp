"use client";

import { useState } from "react";
import { currentResult, useDeleteResult, useMatchResults, useSaveResult, useSetMatchStarted } from "@/hooks/queries/matches";
import { errorMessage } from "@/lib/errors";
import { LoadError } from "@/components/load-error";
import type { Match, Result } from "@/types";
import { ResultType } from "@/types";
import { History, MapPin, Play, Timer, Undo2 } from "lucide-react";
import { MatchStatusBadge } from "@/components/match-status-badge";
import { formatWhen } from "@/lib/format-when";
import { BeerpongTable } from "@/components/BeerpongTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TeamBasic {
  id: string;
  name: string;
}

interface MatchResultDialogProps {
  tournamentId: string;
  match: Match;
  teamA: TeamBasic;
  teamB: TeamBasic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Without an entry the winner had all cups left: what the placeholder shows is what is saved. */
const DEFAULT_CUPS = 10;

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const timeOf = (iso: string) => TIME.format(new Date(iso));

/**
 * The organization's view of a match: start it at its table (or take the start back) and report its result.
 * A result can always be reported, also without a start.
 */
export function MatchResultDialog({ tournamentId, match, teamA, teamB, open, onOpenChange }: Readonly<MatchResultDialogProps>) {
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
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {!loadError && !isLoading && (
          // keyed: a result that arrives later (another device) starts the form again from it
          <ResultForm
            key={currentResult(resultsQuery.data)?.id ?? "new"}
            tournamentId={tournamentId}
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

      {/* Status and table of an open match */}
      {match.status !== "finished" && (
        <div className="flex items-center justify-center gap-2">
          <MatchStatusBadge match={match} className="text-xs" />
          {match.table_name && (match.status === "ready" || match.status === "live") && (
            <Badge variant="outline" className="text-xs gap-1 font-normal text-muted-foreground">
              <MapPin className="w-3 h-3" aria-hidden="true" />
              {match.table_name}
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

        {/* no score here: the table below shows the cups */}
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
  match,
  teamA,
  teamB,
  results,
  locked,
  onDone,
}: Readonly<{
  tournamentId: string;
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
  // tapping the winner puts the cursor into its cups field (on a phone the number pad opens right away);
  // opening an existing result does not
  const [winnerTapped, setWinnerTapped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(existingResult?.winner_team_id ?? null);
  const [cupsLeft, setCupsLeft] = useState<string>(existingResult?.cups_left ? String(existingResult.cups_left) : "");
  const [showHistory, setShowHistory] = useState(false);
  const allResults = results;
  const isStarting = setStarted.isPending;
  const isSubmitting = save.isPending;
  const isDeleting = remove.isPending;
  const failed = save.error ?? remove.error;
  const error = failed ? errorMessage(failed) : null;

  const handleSubmit = () => {
    if (!winnerId) return;
    const cups = cupsLeft.trim() ? Number.parseInt(cupsLeft, 10) : DEFAULT_CUPS;
    save.mutate({ winnerTeamId: winnerId, cupsLeft: cups, existing: !!existingResult }, { onSuccess: onDone });
  };

  const changeStart = (start: boolean) => setStarted.mutate({ match, started: start }, { onSuccess: onDone });

  const handleDelete = () => remove.mutate(undefined, { onSuccess: onDone });

  let leftCups = 10;
  let rightCups = 10;
  if (winnerId === teamA.id) {
    leftCups = cupsLeft ? Number.parseInt(cupsLeft, 10) : 10;
    rightCups = 0;
  } else if (winnerId === teamB.id) {
    leftCups = 0;
    rightCups = cupsLeft ? Number.parseInt(cupsLeft, 10) : 10;
  }

  const hasChanges = !existingResult ||
    existingResult.winner_team_id !== winnerId ||
    String(existingResult.cups_left ?? DEFAULT_CUPS) !== (cupsLeft.trim() || String(DEFAULT_CUPS));

  const savedWinner = existingResult?.winner_team_id === teamA.id ? teamA.name : teamB.name;
  const deleteConsequence = nextMatchId
    ? `${savedWinner} wird aus dem nächsten Spiel wieder entfernt, das Spiel ist wieder offen.`
    : "Das Finale ist wieder offen, das Turnier gilt nicht mehr als beendet.";

  let submitLabel = existingResult ? "Ergebnis ändern" : "Ergebnis speichern";
  if (isSubmitting) submitLabel = "Wird gespeichert…";

  // the cups are optional: empty means all cups left (the placeholder)
  const isValid = winnerId !== null;

  const chooseWinner = (teamId: string) => {
    if (nextMatchHasResult) return;
    setWinnerId(teamId);
    setWinnerTapped(true);
  };

  return (
    <div>
      {/* Start at the table: only for a match at its table; a live one can take the start back */}
      {match.status === "ready" && (
        <Button
          type="button"
          variant="outline"
          onClick={() => changeStart(true)}
          disabled={isStarting}
          className="w-full h-11 mb-3 gap-2 border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/50"
        >
          <Play className="w-4 h-4 fill-current" aria-hidden="true" />
          {isStarting ? "Wird gestartet…" : "Spiel starten"}
        </Button>
      )}
      {match.status === "live" && (
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
            onClick={() => changeStart(false)}
            disabled={isStarting}
            className="gap-1.5 text-muted-foreground"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />
            Start zurücknehmen
          </Button>
        </div>
      )}

      {/* History toggle */}
      {allResults.length > 0 && (
        <div className="mb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-muted-foreground flex justify-between items-center bg-muted/20 hover:bg-muted/40"
          >
            <span>{showHistory ? "Verlauf ausblenden" : "Verlauf anzeigen"}</span>
            <History className="w-4 h-4" />
          </Button>

          {showHistory && (
            <div className="mt-2 space-y-2 max-h-[150px] overflow-y-auto pr-2 border rounded-md p-2 bg-muted/10 animate-in fade-in zoom-in-95 duration-200">
              {allResults.map((r) => (
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
                        {r.type === ResultType.CREATED ? "Gemeldet" : "Geändert"}: {r.winner_team_id === teamA.id ? teamA.name : (r.winner_team_id === teamB.id ? teamB.name : "Unbekannt")}
                        {r.cups_left ? ` (${r.cups_left} Becher)` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lock warning */}
      {nextMatchHasResult && existingResult && (
        <div className="bg-destructive/10 p-3 rounded-md text-sm mb-3 border border-destructive/20 text-destructive">
          <p className="font-semibold">Bearbeiten gesperrt</p>
          <p className="mt-1">
            Für das darauffolgende Spiel liegt bereits ein Ergebnis vor. Bitte lösche zuerst das Ergebnis des Folgespiels.
          </p>
        </div>
      )}

      {/* Beerpong Table */}
      <div className="flex justify-center">
        <BeerpongTable
          leftCups={leftCups}
          rightCups={rightCups}
          compact={true}
          className="w-full"
        />
      </div>

      {/* Team selection cards */}
      <div className="space-y-3">
        <Label className="text-base">Wer hat gewonnen?</Label>
        <div className="grid grid-cols-2 gap-3">
          {/* Team A card */}
          <button
            type="button"
            className={`relative border-2 rounded-xl p-4 flex flex-col items-center justify-start transition-all min-h-[140px] ${winnerId === teamA.id ? "border-red-500 bg-red-500/5 ring-1 ring-red-500" : "border-border bg-card hover:bg-accent/50"
              } ${nextMatchHasResult ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => chooseWinner(teamA.id)}
            disabled={nextMatchHasResult}
          >
            <div className="flex flex-col items-center gap-2 w-full">
              <div className={`w-4 h-4 rounded-full ${winnerId === teamA.id ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-red-500/50"}`} />
              <span className="font-semibold text-center leading-tight">{teamA.name}</span>
            </div>
            {winnerId === teamA.id && (
              <div className="mt-auto pt-3 w-full animate-in fade-in zoom-in-95 duration-200" role="presentation" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <Label htmlFor="cups_left_a" className="text-xs text-red-600 dark:text-red-400 font-medium">Übrige Becher</Label>
                <Input
                  id="cups_left_a"
                  autoFocus={winnerTapped}
                  onFocus={(e) => e.target.select()}
                  type="number"
                  min={1}
                  max={10}
                  placeholder="10"
                  value={cupsLeft}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (Number.parseInt(val) >= 1 && Number.parseInt(val) <= 10)) setCupsLeft(val);
                  }}
                  className="mt-1.5 border-red-500/30 focus-visible:ring-red-500 text-center text-lg h-10 bg-background"
                  disabled={nextMatchHasResult}
                />
              </div>
            )}
          </button>

          {/* Team B card */}
          <button
            type="button"
            className={`relative border-2 rounded-xl p-4 flex flex-col items-center justify-start transition-all min-h-[140px] ${winnerId === teamB.id ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500" : "border-border bg-card hover:bg-accent/50"
              } ${nextMatchHasResult ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => chooseWinner(teamB.id)}
            disabled={nextMatchHasResult}
          >
            <div className="flex flex-col items-center gap-2 w-full">
              <div className={`w-4 h-4 rounded-full ${winnerId === teamB.id ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-blue-500/50"}`} />
              <span className="font-semibold text-center leading-tight">{teamB.name}</span>
            </div>
            {winnerId === teamB.id && (
              <div className="mt-auto pt-3 w-full animate-in fade-in zoom-in-95 duration-200" role="presentation" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                <Label htmlFor="cups_left_b" className="text-xs text-blue-600 dark:text-blue-400 font-medium">Übrige Becher</Label>
                <Input
                  id="cups_left_b"
                  autoFocus={winnerTapped}
                  onFocus={(e) => e.target.select()}
                  type="number"
                  min={1}
                  max={10}
                  placeholder="10"
                  value={cupsLeft}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (Number.parseInt(val) >= 1 && Number.parseInt(val) <= 10)) setCupsLeft(val);
                  }}
                  className="mt-1.5 border-blue-500/30 focus-visible:ring-blue-500 text-center text-lg h-10 bg-background"
                  disabled={nextMatchHasResult}
                />
              </div>
            )}
          </button>
        </div>
      </div>

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
        <div className="mt-6 border-t pt-3">
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
