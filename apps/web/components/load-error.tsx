"use client";

import { RefreshCw } from "lucide-react";
import { ErrorAlert } from "@/components/error-alert";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";

/** A first load that failed: what went wrong and the way out (load again), in the place of the content. */
export function LoadError({
  error,
  fallback,
  onRetry,
}: Readonly<{ error: unknown; fallback: string; onRetry: () => void }>) {
  return (
    <ErrorAlert message={errorMessage(error, fallback)}>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Erneut versuchen
      </Button>
    </ErrorAlert>
  );
}
