"use client";

import { useState } from "react";
import { api } from "@/lib/api";
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
}

export function MatchResultDialog({
  matchId,
  teamA,
  teamB,
  open,
  onOpenChange,
  onSuccess,
}: MatchResultDialogProps) {
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [cupsLeft, setCupsLeft] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!winnerId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const cups = cupsLeft.trim() ? parseInt(cupsLeft, 10) : undefined;
      await api.results.create(matchId, winnerId, cups);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ergebnis eintragen</DialogTitle>
          <DialogDescription>
            Wähle den Gewinner aus und trage optional die verbleibenden Becher ein.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <Label>Gewinnerteam *</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={winnerId === teamA.id ? "default" : "outline"}
                className={`h-16 whitespace-normal text-center ${
                  winnerId === teamA.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                onClick={() => setWinnerId(teamA.id)}
              >
                {teamA.name}
              </Button>
              <Button
                type="button"
                variant={winnerId === teamB.id ? "default" : "outline"}
                className={`h-16 whitespace-normal text-center ${
                  winnerId === teamB.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                onClick={() => setWinnerId(teamB.id)}
              >
                {teamB.name}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cups_left">Verbleibende Becher (Optional)</Label>
            <Input
              id="cups_left"
              type="number"
              min={1}
              max={10}
              placeholder="z.B. 3"
              value={cupsLeft}
              onChange={(e) => setCupsLeft(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !winnerId}>
              {isSubmitting ? "Speichere…" : "Ergebnis speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
