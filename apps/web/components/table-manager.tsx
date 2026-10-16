"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TournamentTable } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [tables, setTables] = useState<TournamentTable[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TournamentTable | null>(null);

  const load = useCallback(async () => {
    try {
      setTables(await api.tournaments.listTables(tournamentId));
    } catch {
      toast.error("Die Tische konnten nicht geladen werden.");
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    try {
      const table = await api.tournaments.addTable(tournamentId);
      setTables((current) => [...(current ?? []), table]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Der Tisch konnte nicht hinzugefügt werden.");
    }
  };

  const handleSave = async (table: TournamentTable, name: string) => {
    if (name.trim() === table.name) {
      setEditingId(null);
      return;
    }
    try {
      const saved = await api.tournaments.renameTable(tournamentId, table.id, name);
      setTables((current) => current?.map((t) => (t.id === saved.id ? saved : t)) ?? null);
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der Name konnte nicht gespeichert werden.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await api.tournaments.deleteTable(tournamentId, toDelete.id);
      setTables((current) => current?.filter((t) => t.id !== toDelete.id) ?? null);
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Der Tisch konnte nicht gelöscht werden.");
    }
  };

  if (tables === null) return null;

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tables.map((table) => (
          <li key={table.id} className="flex flex-col">
            <TableCard
              table={table}
              isOnlyTable={tables.length === 1}
              isEditing={editingId === table.id}
              error={editingId === table.id ? error : null}
              onEdit={() => {
                setError(null);
                setEditingId(table.id);
              }}
              onSave={(name) => void handleSave(table, name)}
              onCancel={() => setEditingId(null)}
              onDelete={() => setToDelete(table)}
            />
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus className="size-5" aria-hidden="true" />
            Tisch hinzufügen
          </button>
        </li>
      </ul>
      {tables.length === 1 && <p className="text-sm text-muted-foreground">Ein Turnier braucht mindestens einen Tisch.</p>}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete?.name} löschen?</AlertDialogTitle>
            <AlertDialogDescription>Der Tisch wird aus dem Turnier entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Tisch löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
