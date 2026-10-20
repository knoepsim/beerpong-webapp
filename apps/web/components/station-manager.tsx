"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAddStation, useDeleteStation, useRenameStation, useStations } from "@/hooks/queries/tournaments";
import { errorMessage } from "@/lib/errors";
import { LoadError } from "@/components/load-error";
import { useConfirm } from "@/components/confirm-dialog";
import type { Station } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStationTerms } from "@/components/game-context";
import { freeOne } from "@/lib/station-terms";

function StationCard({
  station,
  isOnlyStation,
  isEditing,
  error,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: Readonly<{
  station: Station;
  isOnlyStation: boolean;
  isEditing: boolean;
  error: string | null;
  onEdit: () => void;
  onSave: (name: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}>) {
  const [draft, setDraft] = useState(station.name);

  if (isEditing) {
    return (
      <form
        className="space-y-2 rounded-xl border border-primary bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <Input
          autoFocus
          value={draft}
          maxLength={40}
          aria-label={`Name von ${station.name}`}
          aria-invalid={!!error}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          className="h-10"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-10" onClick={onCancel} aria-label="Abbrechen">
            <X aria-hidden="true" />
          </Button>
          <Button type="submit" size="icon" className="size-10" aria-label={`Name von ${station.name} speichern`}>
            <Check aria-hidden="true" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border bg-card p-3">
      <p className="truncate font-semibold">{station.name}</p>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="size-10" onClick={onEdit} aria-label={`${station.name} umbenennen`}>
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={isOnlyStation}
          aria-label={`${station.name} löschen`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** The stations of a tournament as cards: rename, delete (never the last one) and add. */
export function StationManager({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const terms = useStationTerms();
  const { data: stations, error, refetch } = useStations(tournamentId, terms);
  const add = useAddStation(tournamentId, terms);
  const rename = useRenameStation(tournamentId);
  const remove = useDeleteStation(tournamentId, terms);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();

  const startEditing = (id: string | null) => {
    rename.reset();
    setEditingId(id);
  };

  const handleSave = (station: Station, name: string) => {
    if (name.trim() === station.name) {
      startEditing(null);
      return;
    }
    rename.mutate({ stationId: station.id, name }, { onSuccess: () => startEditing(null) });
  };

  const handleDelete = (station: Station) => {
    void confirm({
      title: `${station.name} löschen?`,
      description: `${station.name} wird aus dem Turnier entfernt. Ein Spiel, das dort gerade ist, wartet wieder auf ${freeOne(terms)}.`,
      confirmLabel: `${terms.singular} löschen`,
      destructive: true,
      action: async () => {
        await remove.mutateAsync(station.id);
      },
    });
  };

  if (error && !stations) {
    return <LoadError error={error} fallback={`Die ${terms.plural} konnten nicht geladen werden.`} onRetry={() => void refetch()} />;
  }
  if (!stations) return null;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stations.map((station) => (
          <li key={station.id} className="flex flex-col">
            <StationCard
              station={station}
              isOnlyStation={stations.length === 1}
              isEditing={editingId === station.id}
              error={editingId === station.id && rename.error ? errorMessage(rename.error) : null}
              onEdit={() => startEditing(station.id)}
              onSave={(name) => handleSave(station, name)}
              onCancel={() => startEditing(null)}
              onDelete={() => handleDelete(station)}
            />
          </li>
        ))}
        <li className="flex">
          {/* a card like the stations, the place where the next one appears */}
          <Button
            variant="outline"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="h-auto min-h-[5.5rem] w-full flex-col gap-1 rounded-xl border-dashed text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus aria-hidden="true" />
            {terms.singular} hinzufügen
          </Button>
        </li>
      </ul>
      {stations.length === 1 && <p className="text-sm text-muted-foreground">Ein Turnier braucht mindestens {terms.accusative}.</p>}

    </div>
  );
}
