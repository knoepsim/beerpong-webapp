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
  email: string | null;
  is_system_admin: boolean;
  created_at: string;
}

/** What other users get to see: no phone number, no e-mail. */
export type PublicUser = Pick<User, "id" | "name">;

// ── Team ──────────────────────────────────────────────
export interface TeamMember {
  user_id: string;
  name: string;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  max_size: number;
  members: TeamMember[];
  is_complete: boolean;
  is_deletable: boolean;
  is_renamable: boolean;
  created_at: string;
}

export interface TournamentTeam extends Team {
  is_checked_in: boolean;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  created_at: string;
}

export interface TeamInviteDetails {
  team_id: string;
  team_name: string;
  inviter_name: string;
}

// ── Tournament ────────────────────────────────────────
export enum TournamentMode {
  SINGLE_ELIMINATION = "single_elimination",
}

/** Who sees bracket and results. */
export enum TournamentVisibility {
  PUBLIC = "public",
  PRIVATE = "private",
}

/** Who may join with a team. */
export enum JoinPolicy {
  OPEN = "open",
  INVITE_ONLY = "invite_only",
}

/** An invitation link /invite/{token} of a tournament. */
export interface TournamentInvite {
  id: string;
  token: string;
  label: string | null;
  created_at: string;
  /** Teams that joined through this link. */
  uses: number;
}

/** What a stranger sees of a tournament before joining. */
export interface TournamentPreview {
  tournament_id: string;
  slug: string;
  name: string;
  location: string | null;
  start_time: string | null;
  registration_open: boolean;
  join_policy: JoinPolicy;
}

export type TournamentPhase =
  | "registration"
  | "registration_and_checkin"
  | "registration_closed"
  | "checkin"
  | "running"
  | "finished";

export interface Tournament {
  id: string;
  /** Raised by every change; the live view compares it to know whether it is up to date. */
  revision: number;
  /** The address /t/{slug}. */
  slug: string;
  name: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  registration_end_time: string | null;
  registration_auto_close: boolean;
  checkin_enabled: boolean;
  checkin_start_time: string | null;
  checkin_auto_open: boolean;
  started_at: string | null;
  /** Set while the final has a result. */
  finished_at: string | null;
  /** Computed by the API from the schedule: registration -> registration_closed / checkin -> running -> finished */
  phase: TournamentPhase;
  registration_open: boolean;
  checkin_open: boolean;
  mode: TournamentMode;
  visibility: TournamentVisibility;
  join_policy: JoinPolicy;
  is_deleted: boolean;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentStartResponse {
  team_count: number;
  removed_team_ids: string[];
}

/** A table of a tournament: "Tisch 1", "Tisch 2", ... unless renamed. */
export interface TournamentTable {
  id: string;
  name: string;
  position: number;
}

export interface TournamentCreateRequest {
  name: string;
  slug?: string;
  location?: string | null;
  description?: string | null;
  start_time: string;
  registration_end_time?: string | null;
  registration_auto_close?: boolean;
  checkin_enabled?: boolean;
  checkin_start_time?: string | null;
  checkin_auto_open?: boolean;
  /** How many tables are created with the tournament; they are managed one by one afterwards. */
  table_count?: number;
  mode?: TournamentMode;
  visibility?: TournamentVisibility;
  join_policy?: JoinPolicy;
}

// ── Match & Bracket ───────────────────────────────────
export interface ParticipatingTournament {
  tournament: Tournament;
  team: Team;
}

export interface ManagedTournament {
  tournament: Tournament;
  role: TournamentRoleType;
}

export interface MyTournamentsResponse {
  participating: ParticipatingTournament[];
  managing: ManagedTournament[];
}

/**
 * Decided by the API: waiting (a team is still in another match), queued (waiting for a free table),
 * ready (at its table, not started), live (started), finished (has a result).
 */
export type MatchStatus = "waiting" | "queued" | "ready" | "live" | "finished";

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  team_a_id: string | null;
  team_b_id: string | null;
  next_match_id: string | null;
  next_match_slot: string | null;
  /** The table it is played at (kept once it is finished); null while it has none. Decided by the API. */
  table_id: string | null;
  table_name: string | null;
  /** A ready match without a table: its place in the queue for the next free table (1 = next). */
  queue_position: number | null;
  /** When it was started at its table (only while live). */
  started_at: string | null;
  created_at: string;
  status: MatchStatus;
  winner_team_id: string | null;
  /** cups the winner had left */
  cups_left: number | null;
}

export interface Bracket {
  tournament_id: string;
  total_rounds: number;
  /** winner of the final, once it has a result */
  champion_team_id: string | null;
  matches: Match[];
}

// ── Result ────────────────────────────────────────────
export enum ResultType {
  CREATED = "created",
  MODIFIED = "modified",
  DELETED = "deleted",
}

export interface Result {
  id: string;
  match_id: string;
  type: ResultType;
  winner_team_id: string | null;
  cups_left: number | null;
  reported_by_user_id: string;
  reported_by_username?: string;
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
  user_name?: string;
  role: TournamentRoleType;
  assigned_at: string;
}
