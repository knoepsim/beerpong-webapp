import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import { readEventStream } from "@/lib/sse";

/** The parts of a tournament page that can be loaded on their own. */
export type LiveScope = "tournament" | "teams" | "bracket" | "roles";
export const ALL_SCOPES: LiveScope[] = ["tournament", "teams", "bracket", "roles"];

/** live: the stream is open · connecting: (re)connecting · fallback: no stream, asking every 30 s · paused: tab hidden */
export type LiveStatus = "connecting" | "live" | "fallback" | "paused";

const JITTER_MS = 800; // everybody gets the same signal: not everybody asks at the same moment
const HIDDEN_BEFORE_PAUSE_MS = 60_000;
const FALLBACK_AFTER_FAILURES = 3;
const FALLBACK_POLL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

interface RevisionEvent {
  revision: number;
  changed: string[];
}

const backoff = (failures: number) => Math.min(1000 * 2 ** (failures - 1), MAX_BACKOFF_MS);

/**
 * Keeps a tournament page up to date. The server sends only "revision N, these parts changed"; the page then loads
 * exactly those parts from the normal endpoints (`onChange`). A revision that is not newer than the known one is
 * ignored, so the page's own actions (which reload anyway) do not load twice.
 * Without a stream (3 failed attempts) it asks for the revision every 30 s instead and keeps trying to connect.
 * A hidden tab closes the stream after a minute and reopens it when it is visible again.
 */
export function useTournamentLive({
  tournamentId,
  revision,
  onChange,
}: {
  tournamentId: string | undefined;
  /** The revision of what the page currently shows. */
  revision: number | undefined;
  onChange: (scopes: LiveScope[]) => void | Promise<void>;
}): { status: LiveStatus } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const known = useRef(revision ?? 0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (revision !== undefined) known.current = Math.max(known.current, revision);
  }, [revision]);

  useEffect(() => {
    if (!tournamentId) return;

    let stopped = false;
    let paused = false;
    let failures = 0;
    let controller: AbortController | null = null;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let wake: (() => void) | undefined;
    const pending = new Set<LiveScope>();

    const flush = () => {
      flushTimer = undefined;
      const scopes = ALL_SCOPES.filter((scope) => pending.has(scope));
      pending.clear();
      if (scopes.length > 0) void onChangeRef.current(scopes);
    };

    const handle = ({ revision: next, changed }: RevisionEvent) => {
      if (next <= known.current) return;
      known.current = next;
      for (const scope of changed.includes("all") ? ALL_SCOPES : (changed as LiveScope[])) pending.add(scope);
      flushTimer ??= setTimeout(flush, Math.random() * JITTER_MS);
    };

    const startPolling = () => {
      pollTimer ??= setInterval(() => {
        api.tournaments
          .getState(tournamentId)
          .then(({ revision: next }) => handle({ revision: next, changed: ["all"] }))
          .catch(() => undefined);
      }, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const untilVisible = () => new Promise<void>((resolve) => (wake = resolve));

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer ??= setTimeout(() => {
          paused = true;
          setStatus("paused");
          controller?.abort();
        }, HIDDEN_BEFORE_PAUSE_MS);
      } else {
        clearTimeout(hiddenTimer);
        hiddenTimer = undefined;
        if (paused) {
          paused = false;
          wake?.();
        }
      }
    };

    const connect = async () => {
      while (!stopped) {
        if (paused) {
          await untilVisible();
          continue;
        }
        controller = new AbortController();
        try {
          const token = getAccessToken();
          const response = await fetch(`${API_BASE_URL}/tournaments/${tournamentId}/events`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
          failures = 0;
          stopPolling();
          setStatus("live");
          for await (const event of readEventStream(response.body)) {
            if (event.event === "revision") handle(JSON.parse(event.data) as RevisionEvent);
          }
          // the server ends a stream after a while: connect again right away
        } catch {
          if (stopped) return;
          if (paused) continue;
          failures += 1;
          if (failures >= FALLBACK_AFTER_FAILURES) {
            setStatus("fallback");
            startPolling();
          } else {
            setStatus("connecting");
          }
          await sleep(backoff(failures));
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void connect();

    return () => {
      stopped = true;
      controller?.abort();
      wake?.();
      stopPolling();
      clearTimeout(hiddenTimer);
      clearTimeout(flushTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tournamentId]);

  return { status };
}
