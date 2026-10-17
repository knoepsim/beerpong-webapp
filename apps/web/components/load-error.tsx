"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/** A first load that failed: what went wrong and the way out (load again), in the place of the content. */
export function LoadError({
  error,
  fallback,
  onRetry,
}: Readonly<{ error: unknown; fallback: string; onRetry: () => void }>) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 p-6 text-center">
      <p className="text-sm text-destructive">{errorMessage(error, fallback)}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Erneut versuchen
      </Button>
    </div>
  );
}
