import { MutationCache, QueryCache, QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { notifyError } from "@/lib/errors";

/**
 * What a mutation tells the global handlers (the established pattern of React Query: one place for toasts and for
 * loading again, instead of every screen doing it its own way).
 */
export interface AppMutationMeta extends Record<string, unknown> {
  /** Toast after success, e.g. "Team gelöscht."; a function gets the answer of the API and the variables. */
  successMessage?: string | ((data: unknown, variables: unknown) => string);
  /** Text for an error without a message of its own. */
  errorMessage?: string;
  /**
   * The screen shows the error at its field (a form): no toast. A function decides per error (e.g. only an address
   * that is taken belongs to the field, everything else is a toast).
   */
  inlineError?: boolean | ((error: Error) => boolean);
  /** What is stale afterwards; it is loaded again before the mutation counts as done (the next screen is current). */
  invalidates?: QueryKey[];
}

export interface AppQueryMeta extends Record<string, unknown> {
  /** Text for an error without a message of its own. */
  errorMessage?: string;
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: AppMutationMeta;
    queryMeta: AppQueryMeta;
  }
}

/** Typed success text for `meta.successMessage`. */
export function successMessage<TData, TVariables>(
  message: (data: TData, variables: TVariables) => string,
): (data: unknown, variables: unknown) => string {
  return message as (data: unknown, variables: unknown) => string;
}

const MAX_RETRIES = 2;
const DEFAULT_STALE_MS = 60_000;

/** A refusal of the server (4xx: no access, not found, invalid) stays one when asked again; a hiccup may not. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

const isInline = (meta: AppMutationMeta | undefined, error: Error) =>
  typeof meta?.inlineError === "function" ? meta.inlineError(error) : !!meta?.inlineError;

export function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // a failed first load is shown by the screen itself (with "Erneut versuchen"); a failed refresh keeps the last
      // state on screen and says once that it could not be updated
      onError: (error, query) => {
        if (query.state.data !== undefined) notifyError(error, query.meta?.errorMessage);
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: (data, variables, _onMutateResult, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) toast.success(typeof message === "function" ? message(data, variables) : message);
      },
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (!isInline(mutation.meta, error)) notifyError(error, mutation.meta?.errorMessage);
      },
      // also after an error: the server may have changed in the meantime (that is often why it failed)
      onSettled: async (_data, _error, _variables, _onMutateResult, mutation) => {
        const keys = mutation.meta?.invalidates ?? [];
        await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
      },
    }),
    defaultOptions: {
      queries: { staleTime: DEFAULT_STALE_MS, retry: shouldRetry },
      // a change is sent once: sending it again could do it twice
      mutations: { retry: false },
    },
  });
  return client;
}
