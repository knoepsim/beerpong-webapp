"use client";

import Link from "next/link";
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
import type { Team, TeamDeleteBlocker } from "@/types";

/** What keeps the team from being deleted and what to do about it, in one sentence per tournament. */
function blockerText(blocker: TeamDeleteBlocker): string {
  if (blocker.running) return "spielt gerade – Löschen geht nach dem Turnier.";
  return blocker.registration_open
    ? "angemeldet – im Turnier mit „Turnier verlassen“ abmelden."
    : "angemeldet, die Anmeldung ist zu – Löschen geht nach dem Turnier.";
}

/**
 * "Löschen" is never greyed out (a phone has no tooltip to say why): the dialog either names the consequences and
 * asks, or says which tournaments stand in the way and how to get out of them.
 */
export function DeleteTeamDialog({
  team,
  isDeleting,
  onClose,
  onDelete,
}: Readonly<{
  team: Team | null;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}>) {
  const blockers = team?.delete_blockers ?? [];
  const blocked = blockers.length > 0;

  return (
    <AlertDialog open={!!team} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocked ? `${team?.name} kann noch nicht gelöscht werden` : `${team?.name} löschen?`}
          </AlertDialogTitle>
          {blocked ? (
            <AlertDialogDescription render={<div />}>
              <ul className="space-y-2 text-left">
                {blockers.map((b) => (
                  <li key={b.tournament_slug}>
                    <Link href={`/t/${b.tournament_slug}`} className="font-medium text-foreground underline underline-offset-3">
                      {b.tournament_name}
                    </Link>
                    : {blockerText(b)}
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription>
              Das Team verschwindet aus deinen Teams und kann nicht wiederhergestellt werden. Beendete Turniere zeigen es
              weiter mit seinen Ergebnissen.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {blocked ? (
            <AlertDialogCancel>Schließen</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Wird gelöscht..." : "Team löschen"}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
