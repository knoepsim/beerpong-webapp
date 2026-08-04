"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Result } from "@/types";
import { ResultType } from "@/types";
import { History } from "lucide-react";
import { BeerpongTable } from "@/components/BeerpongTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TeamBasic {
  id: string;
  name: string;
}

interface MatchResultDialogProps {
  matchId: string;
  teamA: TeamBasic;
  teamB: TeamBasic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  nextMatchId?: string | null;
}

export function MatchResultDialog({
  matchId,
  teamA,
  teamB,
  open,
  onOpenChange,
  onSuccess,
  nextMatchId,
}: MatchResultDialogProps) {
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [cupsLeft, setCupsLeft] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingResult, setExistingResult] = useState<Result | null>(null);
  const [allResults, setAllResults] = useState<Result[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [nextMatchHasResult, setNextMatchHasResult] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);

  useEffect(() => {
    if (open) {
      setWinnerId(null);
      setCupsLeft("");
      setError(null);
      setExistingResult(null);
      setNextMatchHasResult(false);

      const loadPrevious = async () => {
        setIsLoadingPrevious(true);
        try {
          const results = await api.results.list(matchId);
          setAllResults(results);
          if (results.length > 0) {
            const current = results[results.length - 1];
            if (current.type !== ResultType.DELETED) {
              setExistingResult(current);
              setWinnerId(current.winner_team_id);
              if (current.cups_left) setCupsLeft(current.cups_left.toString());
            }
          }

          if (nextMatchId) {
            const nextResults = await api.results.list(nextMatchId);
            if (nextResults.length > 0) {
              const nextCurrent = nextResults[nextResults.length - 1];
              if (nextCurrent.type !== ResultType.DELETED) {
                setNextMatchHasResult(true);
              }
            }
          }
        } catch (err) {
          console.error("Fehler beim Laden des vorherigen Ergebnisses", err);
        } finally {
          setIsLoadingPrevious(false);
        }
      };

      loadPrevious();
    }
  }, [open, matchId, nextMatchId]);

  const handleSubmit = async () => {
    if (!winnerId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const cups = cupsLeft.trim() ? parseInt(cupsLeft, 10) : undefined;
      if (existingResult) {
        await api.results.modify(matchId, winnerId, cups);
      } else {
        await api.results.create(matchId, winnerId, cups);
      }
      onSuccess();
      onOpenChange(false);
      // Reset form
      setWinnerId(null);
      setCupsLeft("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Melden des Ergebnisses";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await api.results.delete(matchId);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Löschen des Ergebnisses";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  let leftCups = 10;
  let rightCups = 10;
  if (winnerId === teamA.id) {
    leftCups = cupsLeft ? parseInt(cupsLeft, 10) : 10;
    rightCups = 0;
  } else if (winnerId === teamB.id) {
    leftCups = 0;
    rightCups = cupsLeft ? parseInt(cupsLeft, 10) : 10;
  }

  const hasChanges = !existingResult || 
    existingResult.winner_team_id !== winnerId || 
    (existingResult.cups_left?.toString() || "") !== cupsLeft.trim();
    
  const isValid = winnerId !== null && cupsLeft.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ergebnis eintragen</DialogTitle>
          <DialogDescription>
            Wähle den Gewinner aus und trage die verbleibenden Becher ein.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">
          {isLoadingPrevious ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {allResults.length > 0 && (
                <div className="mb-2">
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
                            <span>{new Date(r.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
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
              {nextMatchHasResult && existingResult && (
                <div className="bg-destructive/10 p-3 rounded-md text-sm mb-2 border border-destructive/20 text-destructive">
                  <p className="font-semibold">Bearbeiten gesperrt</p>
                  <p className="mt-1">
                    Für das darauffolgende Spiel liegt bereits ein Ergebnis vor. Bitte lösche zuerst das Ergebnis des Folgespiels, um dieses Ergebnis bearbeiten oder löschen zu können.
                  </p>
                </div>
              )}

              <div className="flex justify-center">
                <BeerpongTable
                  leftCups={leftCups}
                  rightCups={rightCups}
                  compact={true}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base">Wer hat gewonnen?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`relative border-2 rounded-xl p-4 flex flex-col items-center justify-start transition-all min-h-[140px] ${winnerId === teamA.id ? "border-red-500 bg-red-500/5 ring-1 ring-red-500" : "border-border bg-card hover:bg-accent/50"
                      } ${nextMatchHasResult ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => !nextMatchHasResult && setWinnerId(teamA.id)}
                    disabled={nextMatchHasResult}
                  >
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className={`w-4 h-4 rounded-full ${winnerId === teamA.id ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-red-500/50"}`} />
                      <span className="font-semibold text-center leading-tight">{teamA.name}</span>
                    </div>
                    {winnerId === teamA.id && (
                      <div className="mt-auto pt-3 w-full animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <Label htmlFor="cups_left_a" className="text-xs text-red-600 dark:text-red-400 font-medium">Übrige Becher *</Label>
                        <Input
                          id="cups_left_a"
                          type="number"
                          min={1}
                          max={10}
                          placeholder="10"
                          value={cupsLeft}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 10)) setCupsLeft(val);
                          }}
                          className="mt-1.5 border-red-500/30 focus-visible:ring-red-500 text-center text-lg h-10 bg-background"
                          disabled={nextMatchHasResult}
                        />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`relative border-2 rounded-xl p-4 flex flex-col items-center justify-start transition-all min-h-[140px] ${winnerId === teamB.id ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500" : "border-border bg-card hover:bg-accent/50"
                      } ${nextMatchHasResult ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() => !nextMatchHasResult && setWinnerId(teamB.id)}
                    disabled={nextMatchHasResult}
                  >
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className={`w-4 h-4 rounded-full ${winnerId === teamB.id ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-blue-500/50"}`} />
                      <span className="font-semibold text-center leading-tight">{teamB.name}</span>
                    </div>
                    {winnerId === teamB.id && (
                      <div className="mt-auto pt-3 w-full animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <Label htmlFor="cups_left_b" className="text-xs text-blue-600 dark:text-blue-400 font-medium">Übrige Becher *</Label>
                        <Input
                          id="cups_left_b"
                          type="number"
                          min={1}
                          max={10}
                          placeholder="10"
                          value={cupsLeft}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 10)) setCupsLeft(val);
                          }}
                          className="mt-1.5 border-blue-500/30 focus-visible:ring-blue-500 text-center text-lg h-10 bg-background"
                          disabled={nextMatchHasResult}
                        />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-2 mt-6">
                <div className="flex gap-2 w-full">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                    Abbrechen
                  </Button>
                  <Button onClick={handleSubmit} disabled={!isValid || !hasChanges || isSubmitting || nextMatchHasResult} className="flex-1">
                    {isSubmitting ? "Wird gespeichert..." : existingResult ? "Überschreiben" : "Speichern"}
                  </Button>
                </div>
                {existingResult && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting || nextMatchHasResult}
                    className="w-full"
                  >
                    {isDeleting ? "Wird gelöscht..." : "Ergebnis löschen"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
