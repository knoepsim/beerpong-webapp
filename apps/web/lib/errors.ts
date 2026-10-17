import { toast } from "sonner";
import { ApiError, NetworkError } from "@/lib/api";

export const GENERIC_ERROR = "Das hat nicht geklappt. Versuch es noch einmal.";

/**
 * What went wrong, in words for the user: the API says it in German (and the connection error does too); anything
 * else (a bug, a browser message in English) gets the general sentence instead of a technical text.
 */
export function errorMessage(error: unknown, fallback = GENERIC_ERROR): string {
  if (error instanceof ApiError || error instanceof NetworkError) return error.message;
  return fallback;
}

const reported = new WeakSet<object>();

/**
 * Shows an error as a toast, once per error: when the global handler of the mutations has shown it already, a dialog
 * that sees the same error afterwards does not show it a second time.
 */
export function notifyError(error: unknown, fallback?: string): void {
  if (typeof error === "object" && error !== null) {
    if (reported.has(error)) return;
    reported.add(error);
  }
  toast.error(errorMessage(error, fallback));
}
