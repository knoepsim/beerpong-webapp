"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  /** A question with the action: "Turnier starten?" */
  title: string;
  /** The concrete consequences: what happens, to whom, whether it can be undone. */
  description?: ReactNode;
  /** Verb and object: "Turnier starten", "Team entfernen". */
  confirmLabel: string;
  /** Deleting or removing: the button is red. */
  destructive?: boolean;
  /** Runs on confirmation; the dialog shows that it runs and stays open with the message if it fails. */
  action: () => Promise<void> | void;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * One confirmation dialog for the whole app: actions with consequences (start, delete, remove, open check-in) ask
 * the same way everywhere, show that they run, and name a failure right in the dialog.
 */
export function ConfirmProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        const next = { ...options, resolve };
        current.current = next;
        setError(null);
        setPending(next);
      }),
    [],
  );

  const close = (confirmed: boolean) => {
    current.current?.resolve(confirmed);
    current.current = null;
    setPending(null);
  };

  const run = async () => {
    if (!pending) return;
    setRunning(true);
    setError(null);
    try {
      await pending.action();
      close(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Das hat nicht geklappt. Versuch es noch einmal.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !running && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            {pending?.description && <AlertDialogDescription>{pending.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Abbrechen</AlertDialogCancel>
            <Button variant={pending?.destructive ? "destructive" : "default"} onClick={() => void run()} disabled={running}>
              {running ? "Bitte warten..." : pending?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

/** Ask before an action with consequences; resolves to whether it was confirmed (and ran without error). */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm needs a ConfirmProvider around it");
  return confirm;
}
