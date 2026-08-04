import { API_BASE_URL } from "./config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";
import type {
  Bracket,
  Team,
  TeamInvite,
  TeamInviteDetails,
  TokenResponse,
  Tournament,
  TournamentCreateRequest,
  TournamentUserRole,
  User,
  Result,
  MyTournamentsResponse,
  TournamentTeam,
} from "@/types";

export class ApiError extends Error {
  constructor(public status: number, public data: Record<string, unknown>) {
    let msg = "Ein Fehler ist aufgetreten";
    if (Array.isArray(data?.detail)) {
      msg = data.detail.map((e: any) => e.msg).join(", ");
    } else if (typeof data?.detail === "string") {
      msg = data.detail;
    }
    super(msg);
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

  if (res.status === 401) {
    if (token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers });
        if (res.status !== 401) return res;
      }
    }
    
    if (typeof window !== "undefined") {
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
      // Prevent further execution while browser is redirecting
      await new Promise(() => {});
    }
  }

  return res;
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    updateMe: (data: { name?: string; email?: string }) =>
      request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    search: (query: string) =>
      request<User[]>(`/users/search?query=${encodeURIComponent(query)}`),
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
    get: (id: string) => request<Team>(`/teams/${id}`),
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
    list: () => request<Tournament[]>("/tournaments"),
    getMyTournaments: () => request<MyTournamentsResponse>("/tournaments/me"),
    get: (id: string, inviteToken?: string | null) => 
      request<Tournament>(`/tournaments/${id}${inviteToken ? `?invite=${inviteToken}` : ''}`),
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
    join: (tournamentId: string, teamId: string, inviteToken?: string | null) =>
      request<void>(`/tournaments/${tournamentId}/join`, {
        method: "POST",
        body: JSON.stringify({ team_id: teamId, invite_token: inviteToken }),
      }),
    leave: (tournamentId: string) =>
      request<void>(`/tournaments/${tournamentId}/leave`, { method: "DELETE" }),
    removeTeam: (tournamentId: string, teamId: string) =>
      request<void>(`/tournaments/${tournamentId}/teams/${teamId}`, { method: "DELETE" }),
    generateBracket: (id: string) =>
      request<Bracket>(`/tournaments/${id}/generate-bracket`, { method: "POST" }),
    startTournament: (id: string) =>
      request<void>(`/tournaments/${id}/start`, { method: "POST" }),
    getBracket: (id: string) =>
      request<Bracket>(`/tournaments/${id}/bracket`),
    getTeams: (id: string) =>
      request<TournamentTeam[]>(`/tournaments/${id}/teams`),
    checkin: (tournamentId: string, teamId: string, is_checked_in: boolean) =>
      request<void>(`/tournaments/${tournamentId}/teams/${teamId}/checkin`, {
        method: "POST",
        body: JSON.stringify({ is_checked_in }),
      }),
    generateInvite: (tournamentId: string) =>
      request<{token: string}>(`/tournaments/${tournamentId}/invite`, {
        method: "POST",
      }),
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
