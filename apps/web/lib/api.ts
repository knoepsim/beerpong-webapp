import { API_BASE_URL } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";
import type {
  Bracket,
  Team,
  TeamInvite,
  TokenResponse,
  Tournament,
  TournamentCreateRequest,
  TournamentUserRole,
  User,
  Result,
} from "@/types";

export class ApiError extends Error {
  constructor(public status: number, public data: Record<string, unknown>) {
    super((data?.detail as string) || "Ein Fehler ist aufgetreten");
  }
}

// ── Core fetch logic ──────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    } else if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  return res;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (!options.headers) {
    options.headers = { "Content-Type": "application/json" };
  }

  const res = await fetchWithAuth(url, options);

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { detail: res.statusText };
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
    verify: (phone_number: string, code: string) =>
      request<TokenResponse>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ phone_number, code }),
      }),
  },

  users: {
    me: () => request<User>("/users/me"),
    updateMe: (name: string) =>
      request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
  },

  teams: {
    list: () => request<Team[]>("/teams"),
    get: (id: string) => request<Team>(`/teams/${id}`),
    create: (name: string) =>
      request<Team>("/teams", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    createInvite: (teamId: string) =>
      request<TeamInvite>(`/teams/${teamId}/invite`, { method: "POST" }),
    acceptInvite: (token: string) =>
      request<Team>(`/teams/join/${token}`, { method: "POST" }),
  },

  tournaments: {
    list: () => request<Tournament[]>("/tournaments"),
    get: (id: string) => request<Tournament>(`/tournaments/${id}`),
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
    start: (id: string) =>
      request<Bracket>(`/tournaments/${id}/start`, { method: "POST" }),
    getBracket: (id: string) =>
      request<Bracket>(`/tournaments/${id}/bracket`),
  },

  roles: {
    list: (tournamentId: string) =>
      request<TournamentUserRole[]>(`/tournaments/${tournamentId}/roles`),
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

  results: {
    list: (matchId: string) =>
      request<Result[]>(`/matches/${matchId}/results`),
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
