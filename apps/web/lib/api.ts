import { API_BASE_URL } from "./config";
import type {
  Bracket,
  Team,
  TeamInvite,
  TeamInviteDetails,
  Tournament,
  TournamentCreateRequest,
  TournamentInvite,
  TournamentPreview,
  TournamentStartResponse,
  TournamentTable,
  TournamentUserRole,
  User,
  PublicUser,
  Result,
  MyTournamentsResponse,
  TournamentTeam,
  Invitation,
  TournamentInvitation,
} from "@/types";

const SERVER_PROBLEM = "Der Server hat gerade ein Problem. Versuch es gleich noch einmal.";

export class ApiError extends Error {
  constructor(public status: number, public data: Record<string, unknown>) {
    let msg = "Ein Fehler ist aufgetreten";
    if (Array.isArray(data?.detail)) {
      msg = data.detail.map((e: { msg?: unknown }) => String(e.msg).replace(/^Value error, /, "")).join(", ");
    } else if (typeof data?.detail === "string") {
      msg = data.detail;
    }
    super(msg);
  }
}

// Tournament invite token, forwarded so private tournaments stay readable via invite link

// ── Core fetch logic ──────────────────────────────────

// The session is a pair of HttpOnly cookies. The access token in it lives only minutes and is renewed in the
// background with the refresh cookie, so somebody who takes the phone out of the pocket after an hour is still logged
// in; the session ends after REFRESH_TOKEN_EXPIRE_DAYS without use (every renewal starts the time again).
const CSRF_HEADER = { "X-Requested-With": "fetch" };
const SESSION_LOCK = "beerpong-session";

/** Runs `task` alone: in all tabs of the browser if possible (they share the cookies), else only in this one. */
function exclusively<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== "undefined" && navigator.locks
    ? (navigator.locks.request(SESSION_LOCK, () => task()) as unknown as Promise<T>)
    : task();
}

/** The server cannot be reached (no network, a hiccup): no reason to doubt the session, try again later. */
export class NetworkError extends Error {
  constructor() {
    super("Keine Verbindung zum Server. Prüfe dein Netz und versuche es noch einmal.");
    this.name = "NetworkError";
  }
}

/**
 * Renews the session with the refresh cookie. Only a refusal ends the session ("ended"); that the server cannot be
 * reached or answers with an error is not the answer of the server to the session ("unreachable").
 */
async function renewSession(): Promise<"renewed" | "ended" | "unreachable"> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: CSRF_HEADER,
      credentials: "include",
    });
    if (res.ok) return "renewed";
    return res.status === 401 || res.status === 403 ? "ended" : "unreachable";
  } catch {
    return "unreachable";
  }
}

interface FetchOptions extends RequestInit {
  /** A 401 means "not logged in" and is no reason to go to the login (public pages, finding out who is logged in). */
  guest?: boolean;
}

async function fetchWithAuth(url: string, { guest = false, ...options }: FetchOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  for (const [name, value] of Object.entries(CSRF_HEADER)) headers.set(name, value);
  const send = () =>
    fetch(url, { ...options, headers, credentials: "include" }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new NetworkError();
    });

  let res = await send();

  if (res.status === 401) {
    // One renewal at a time: with rotating refresh tokens a second, parallel one would end the session. Whoever comes
    // second first tries again, because the one before may have renewed the cookies already.
    res = await exclusively(async () => {
      const again = await send();
      if (again.status !== 401) return again;
      const outcome = await renewSession();
      if (outcome === "unreachable") throw new NetworkError(); // stay where you are, the session may well be fine
      return outcome === "renewed" ? send() : again;
    });
  }

  if (res.status === 401 && !guest && typeof window !== "undefined") {
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
    // Prevent further execution while browser is redirecting
    await new Promise(() => {});
  }

  return res;
}

export async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (!options.headers) {
    options.headers = { "Content-Type": "application/json" };
  }
  if (!options.cache) {
    options.cache = "no-store";
  }

  const res = await fetchWithAuth(url, options);

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      // no answer of the API (a crash, a proxy): the status text is English and technical, say it in our words
      errorData = { detail: res.status >= 500 ? SERVER_PROBLEM : "Ein Fehler ist aufgetreten. Versuch es noch einmal." };
    }
    throw new ApiError(res.status, errorData);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// ── Typed API methods ─────────────────────────────────

export const api = {
  auth: {
    requestCode: (phone_number: string) =>
      request<void>("/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ phone_number }),
      }),
    /** Logs in: the server answers with the session as HttpOnly cookies, not with tokens. */
    verify: (phone_number: string, code: string) =>
      request<void>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ phone_number, code, cookie_session: true }),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },

  users: {
    /** `guest`: without a session this is an answer ("nobody"), not a reason to go to the login. */
    me: (options: { guest?: boolean } = {}) => request<User>("/users/me", options),
    updateMe: (data: { name?: string; email?: string }) =>
      request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    search: (query: string) =>
      request<PublicUser[]>(`/users/search?query=${encodeURIComponent(query)}`),
    requestPhoneChange: (new_phone_number: string) =>
      request<void>("/users/me/phone/request", {
        method: "POST",
        body: JSON.stringify({ new_phone_number }),
      }),
    verifyPhoneChange: (new_phone_number: string, code: string) =>
      request<User>("/users/me/phone/verify", {
        method: "POST",
        body: JSON.stringify({ new_phone_number, code }),
      }),
  },

  teams: {
    list: () => request<Team[]>("/teams"),
    create: (name: string) =>
      request<Team>("/teams", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    update: (id: string, name: string) =>
      request<Team>(`/teams/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) =>
      request<void>(`/teams/${id}`, {
        method: "DELETE",
      }),
    createInvite: (teamId: string) =>
      request<TeamInvite>(`/teams/${teamId}/invite`, { method: "POST" }),
    getInviteDetails: (token: string) =>
      request<TeamInviteDetails>(`/teams/invite/${token}`),
    acceptInvite: (token: string) =>
      request<Team>(`/teams/join/${token}`, { method: "POST" }),
  },

  tournaments: {
    getMyTournaments: () => request<MyTournamentsResponse>("/tournaments/me"),
    get: (id: string) => request<Tournament>(`/tournaments/${id}`),
    getBySlug: (slug: string) => request<Tournament>(`/tournaments/by-slug/${encodeURIComponent(slug)}`),
    /** What a stranger may see of a tournament everybody may join; 404 for all others. */
    /** Only the revision: the cheap "has anything changed?". */
    getState: (id: string) => request<{ revision: number }>(`/tournaments/${id}/state`),
    getPreview: (slug: string) =>
      request<TournamentPreview>(`/tournaments/by-slug/${encodeURIComponent(slug)}/preview`),
    listTables: (tournamentId: string) => request<TournamentTable[]>(`/tournaments/${tournamentId}/tables`),
    /** Without a name the new table is called "Tisch {n}". */
    addTable: (tournamentId: string, name?: string) =>
      request<TournamentTable>(`/tournaments/${tournamentId}/tables`, {
        method: "POST",
        body: JSON.stringify({ name: name || null }),
      }),
    renameTable: (tournamentId: string, tableId: string, name: string) =>
      request<TournamentTable>(`/tournaments/${tournamentId}/tables/${tableId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    deleteTable: (tournamentId: string, tableId: string) =>
      request<void>(`/tournaments/${tournamentId}/tables/${tableId}`, { method: "DELETE" }),
    listInvites: (tournamentId: string) => request<TournamentInvite[]>(`/tournaments/${tournamentId}/invites`),
    createInvite: (tournamentId: string, label?: string) =>
      request<TournamentInvite>(`/tournaments/${tournamentId}/invites`, {
        method: "POST",
        body: JSON.stringify({ label: label || null }),
      }),
    deleteInvite: (tournamentId: string, inviteId: string) =>
      request<void>(`/tournaments/${tournamentId}/invites/${inviteId}`, { method: "DELETE" }),
    listInvitations: (tournamentId: string) =>
      request<TournamentInvitation[]>(`/tournaments/${tournamentId}/invitations`),
    invitePerson: (tournamentId: string, userId: string) =>
      request<TournamentInvitation>(`/tournaments/${tournamentId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      }),
    withdrawInvitation: (tournamentId: string, invitationId: string) =>
      request<void>(`/tournaments/${tournamentId}/invitations/${invitationId}`, { method: "DELETE" }),
    create: (data: TournamentCreateRequest) =>
      request<Tournament>("/tournaments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<TournamentCreateRequest>) =>
      request<Tournament>(`/tournaments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/tournaments/${id}`, { method: "DELETE" }),
    join: (tournamentId: string, teamId: string) =>
      request<void>(`/tournaments/${tournamentId}/join`, {
        method: "POST",
        body: JSON.stringify({ team_id: teamId }),
      }),
    leave: (tournamentId: string) =>
      request<void>(`/tournaments/${tournamentId}/leave`, { method: "DELETE" }),
    removeTeam: (tournamentId: string, teamId: string) =>
      request<void>(`/tournaments/${tournamentId}/teams/${teamId}`, { method: "DELETE" }),
    setRegistrationOpen: (id: string, open: boolean) =>
      request<void>(`/tournaments/${id}/registration`, { method: "PUT", body: JSON.stringify({ open }) }),
    setCheckinOpen: (id: string, open: boolean) =>
      request<void>(`/tournaments/${id}/checkin`, { method: "PUT", body: JSON.stringify({ open }) }),
    startTournament: (id: string) =>
      request<TournamentStartResponse>(`/tournaments/${id}/start`, { method: "POST" }),
    getBracket: (id: string) => request<Bracket>(`/tournaments/${id}/bracket`),
    getTeams: (id: string) => request<TournamentTeam[]>(`/tournaments/${id}/teams`),
    checkin: (tournamentId: string, teamId: string, is_checked_in: boolean) =>
      request<void>(`/tournaments/${tournamentId}/teams/${teamId}/checkin`, {
        method: "POST",
        body: JSON.stringify({ is_checked_in }),
      }),
  },

  invites: {
    /** The tournament behind an invitation link; works without login. */
    get: (token: string) => request<TournamentPreview>(`/invites/${encodeURIComponent(token)}`),
    /** Keeps the invitation of the link in my account (or opens a declined one again). */
    accept: (token: string) => request<Invitation>(`/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  },

  invitations: {
    /** My open invitations, while the tournament can still be joined. */
    list: () => request<Invitation[]>("/invitations"),
    get: (id: string) => request<Invitation>(`/invitations/${id}`),
    accept: (id: string, teamId: string) =>
      request<Invitation>(`/invitations/${id}/accept`, { method: "POST", body: JSON.stringify({ team_id: teamId }) }),
    decline: (id: string) => request<Invitation>(`/invitations/${id}/decline`, { method: "POST" }),
    reopen: (id: string) => request<Invitation>(`/invitations/${id}/reopen`, { method: "POST" }),
  },

  roles: {
    list: (tournamentId: string) => request<TournamentUserRole[]>(`/tournaments/${tournamentId}/roles`),
    assign: (tournamentId: string, userId: string, role: string) =>
      request<TournamentUserRole>(`/tournaments/${tournamentId}/roles`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, role }),
      }),
    revoke: (tournamentId: string, roleId: string) =>
      request<void>(`/tournaments/${tournamentId}/roles/${roleId}`, {
        method: "DELETE",
      }),
  },

  matches: {
    /** Start a match at its table (live); a result can also be reported without a start. */
    start: (matchId: string) => request<void>(`/matches/${matchId}/start`, { method: "POST" }),
    undoStart: (matchId: string) => request<void>(`/matches/${matchId}/start`, { method: "DELETE" }),
  },

  results: {
    list: (matchId: string) => request<Result[]>(`/matches/${matchId}/results`),
    create: (matchId: string, winnerTeamId: string, cupsLeft?: number) =>
      request<Result>(`/matches/${matchId}/results`, {
        method: "POST",
        body: JSON.stringify({ winner_team_id: winnerTeamId, cups_left: cupsLeft }),
      }),
    modify: (matchId: string, winnerTeamId: string, cupsLeft?: number) =>
      request<Result>(`/matches/${matchId}/results`, {
        method: "PATCH",
        body: JSON.stringify({ winner_team_id: winnerTeamId, cups_left: cupsLeft }),
      }),
    delete: (matchId: string) =>
      request<Result>(`/matches/${matchId}/results`, { method: "DELETE" }),
  },
};
