// ── Auth ──────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ── User ──────────────────────────────────────────────
export interface User {
  id: string;
  phone_number: string;
  name: string;
  created_at: string;
}

// ── Team ──────────────────────────────────────────────
export interface TeamMember {
  user_id: string;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  max_size: number;
  members: TeamMember[];
  is_complete: boolean;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  created_at: string;
}

// ── Tournament ────────────────────────────────────────
export enum TournamentMode {
  SINGLE_ELIMINATION = "single_elimination",
}

export enum TournamentVisibility {
  PRIVATE = "private",
  PUBLIC_LISTED = "public_listed",
  PUBLIC_UNLISTED = "public_unlisted",
}

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  table_count: number;
  mode: TournamentMode;
  visibility: TournamentVisibility;
  is_deleted: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentCreateRequest {
  name: string;
  location?: string | null;
  description?: string | null;
  start_time?: string | null;
  table_count?: number;
  mode?: TournamentMode;
  visibility?: TournamentVisibility;
}

// ── Match & Bracket ───────────────────────────────────
export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  next_match_id: string | null;
  next_match_slot: string | null;
  table_number: number | null;
  created_at: string;
}

export interface Bracket {
  tournament_id: string;
  total_rounds: number;
  matches: Match[];
}

// ── Result ────────────────────────────────────────────
export enum ResultType {
  CREATED = "CREATED",
  MODIFIED = "MODIFIED",
  DELETED = "DELETED",
}

export interface Result {
  id: string;
  match_id: string;
  type: ResultType;
  winner_team_id: string | null;
  cups_left: number | null;
  reported_by_user_id: string;
  created_at: string;
}

// ── Roles ─────────────────────────────────────────────
export enum TournamentRoleType {
  ADMIN = "admin",
  MANAGER = "manager",
  REFEREE = "referee",
}

export interface TournamentUserRole {
  id: string;
  tournament_id: string;
  user_id: string;
  role: TournamentRoleType;
  assigned_at: string;
}
