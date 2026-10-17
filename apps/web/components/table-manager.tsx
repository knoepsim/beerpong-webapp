"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAddTable, useDeleteTable, useRenameTable, useTournamentTables } from "@/hooks/queries/tournaments";
import { errorMessage } from "@/lib/errors";
import { LoadError } from "@/components/load-error";
import { useConfirm } from "@/components/confirm-dialog";
import type { TournamentTable } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function TableCard({
  table,
  isOnlyTable,
  isEditing,
  error,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: Readonly<{
  table: TournamentTable;
  isOnlyTable: boolean;
  isEditing: boolean;
  error: string | null;
  onEdit: () => void;
  onSave: (name: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}>) {
  const [draft, setDraft] = useState(table.name);

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
          aria-label={`Name von ${table.name}`}
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
          <Button type="submit" size="icon" className="size-10" aria-label={`Name von ${table.name} speichern`}>
            <Check aria-hidden="true" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border bg-card p-3">
      <p className="truncate font-semibold">{table.name}</p>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="size-10" onClick={onEdit} aria-label={`${table.name} umbenennen`}>
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={isOnlyTable}
          aria-label={`${table.name} löschen`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** The tables of a tournament as cards: rename, delete (never the last one) and add. */
export function TableManager({ tournamentId }: Readonly<{ tournamentId: string }>) {
  const { data: tables, error, refetch } = useTournamentTables(tournamentId);
  const add = useAddTable(tournamentId);
  const rename = useRenameTable(tournamentId);
  const remove = useDeleteTable(tournamentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const confirm = useConfirm();

  const startEditing = (id: string | null) => {
    rename.reset();
    setEditingId(id);
  };

  const handleSave = (table: TournamentTable, name: string) => {
    if (name.trim() === table.name) {
      startEditing(null);
      return;
    }
    rename.mutate({ tableId: table.id, name }, { onSuccess: () => startEditing(null) });
  };

  const handleDelete = (table: TournamentTable) => {
    void confirm({
      title: `${table.name} löschen?`,
      description: "Der Tisch wird aus dem Turnier entfernt. Ein Spiel, das dort gerade ist, wartet wieder auf einen freien Tisch.",
      confirmLabel: "Tisch löschen",
      destructive: true,
      action: async () => {
        await remove.mutateAsync(table.id);
      },
    });
  };

  if (error && !tables) {
    return <LoadError error={error} fallback="Die Tische konnten nicht geladen werden." onRetry={() => void refetch()} />;
  }
  if (!tables) return null;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tables.map((table) => (
          <li key={table.id} className="flex flex-col">
            <TableCard
              table={table}
              isOnlyTable={tables.length === 1}
              isEditing={editingId === table.id}
              error={editingId === table.id && rename.error ? errorMessage(rename.error) : null}
              onEdit={() => startEditing(table.id)}
              onSave={(name) => handleSave(table, name)}
              onCancel={() => startEditing(null)}
              onDelete={() => handleDelete(table)}
            />
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-5" aria-hidden="true" />
            Tisch hinzufügen
          </button>
        </li>
      </ul>
      {tables.length === 1 && <p className="text-sm text-muted-foreground">Ein Turnier braucht mindestens einen Tisch.</p>}

    </div>
  );
}
