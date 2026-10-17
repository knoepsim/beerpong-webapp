"use client";

import Link from "next/link";
import {
  AlertDialog,
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
 * "Löschen" is never greyed out (a phone has no tooltip to say why): when tournaments stand in the way, this says
 * which and how to get out of them. A team that can be deleted gets the app's confirmation dialog instead.
 */
export function TeamDeleteBlockers({ team, onClose }: Readonly<{ team: Team | null; onClose: () => void }>) {
  return (
    <AlertDialog open={!!team} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{team?.name} kann noch nicht gelöscht werden</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <ul className="space-y-2 text-left">
              {team?.delete_blockers.map((b) => (
                <li key={b.tournament_slug}>
                  <Link href={`/t/${b.tournament_slug}`} className="font-medium text-foreground underline underline-offset-3">
                    {b.tournament_name}
                  </Link>
                  : {blockerText(b)}
                </li>
              ))}
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
