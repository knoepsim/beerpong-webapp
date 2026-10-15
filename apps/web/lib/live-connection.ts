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
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface LiveConnectionOptions {
  tournamentId: string;
  /** The revision of what the page shows; raised by the connection as it sees newer ones. */
  known: { current: number };
  onChange: (scopes: LiveScope[]) => void | Promise<void>;
  onStatus: (status: LiveStatus) => void;
}

/**
 * The live connection of one tournament page. The server sends only "revision N, these parts changed"; `onChange`
 * then gets exactly those parts. A revision that is not newer than the known one is ignored, so the page's own
 * actions (which reload anyway) do not load twice. Without a stream (3 failed attempts) it asks for the revision
 * every 30 s and keeps trying to connect. A hidden tab closes the stream after a minute and reopens it when visible.
 */
export class LiveConnection {
  private stopped = false;
  private paused = false;
  private failures = 0;
  private controller: AbortController | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private wake: (() => void) | undefined;
  private readonly pending = new Set<LiveScope>();

  constructor(private readonly options: LiveConnectionOptions) {}

  start() {
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.run();
  }

  stop() {
    this.stopped = true;
    this.controller?.abort();
    this.wake?.();
    this.stopPolling();
    clearTimeout(this.hiddenTimer);
    clearTimeout(this.flushTimer);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  // -- what the server tells

  private handleRevision({ revision, changed }: RevisionEvent) {
    if (revision <= this.options.known.current) return;
    this.options.known.current = revision;
    for (const scope of changed.includes("all") ? ALL_SCOPES : (changed as LiveScope[])) this.pending.add(scope);
    // Jitter only spreads the requests of the viewers, it is no secret: Math.random is fine
    this.flushTimer ??= setTimeout(() => this.flush(), Math.random() * JITTER_MS); // NOSONAR
  }

  private flush() {
    this.flushTimer = undefined;
    const scopes = ALL_SCOPES.filter((scope) => this.pending.has(scope));
    this.pending.clear();
    if (scopes.length > 0) void this.options.onChange(scopes);
  }

  // -- connection

  private async run() {
    while (!this.stopped) {
      if (this.paused) {
        await new Promise<void>((resolve) => (this.wake = resolve)); // NOSONAR: a loop that waits is the point here
        continue;
      }
      await this.attempt(); // NOSONAR
    }
  }

  private async attempt() {
    this.controller = new AbortController();
    try {
      await this.readStream(this.controller.signal);
      // the server ends a stream after a while: connect again right away
    } catch {
      await this.failed();
    }
  }

  private async readStream(signal: AbortSignal) {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/tournaments/${this.options.tournamentId}/events`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
      cache: "no-store",
    });
    if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
    this.failures = 0;
    this.stopPolling();
    this.options.onStatus("live");
    for await (const event of readEventStream(response.body)) {
      if (event.event === "revision") this.handleRevision(JSON.parse(event.data) as RevisionEvent);
    }
  }

  private async failed() {
    if (this.stopped || this.paused) return;
    this.failures += 1;
    if (this.failures >= FALLBACK_AFTER_FAILURES) {
      this.options.onStatus("fallback");
      this.startPolling();
    } else {
      this.options.onStatus("connecting");
    }
    await sleep(backoff(this.failures));
  }

  // -- without a stream

  private startPolling() {
    this.pollTimer ??= setInterval(() => {
      api.tournaments
        .getState(this.options.tournamentId)
        .then(({ revision }) => this.handleRevision({ revision, changed: ["all"] }))
        .catch(() => undefined);
    }, FALLBACK_POLL_MS);
  }

  private stopPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  // -- hidden tab

  private readonly onVisibility = () => {
    if (document.visibilityState === "hidden") this.pauseSoon();
    else this.resume();
  };

  private pauseSoon() {
    this.hiddenTimer ??= setTimeout(() => {
      this.paused = true;
      this.options.onStatus("paused");
      this.controller?.abort();
    }, HIDDEN_BEFORE_PAUSE_MS);
  }

  private resume() {
    clearTimeout(this.hiddenTimer);
    this.hiddenTimer = undefined;
    if (!this.paused) return;
    this.paused = false;
    this.wake?.();
  }
}
