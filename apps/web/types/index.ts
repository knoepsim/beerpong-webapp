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

/** A tournament that keeps a team from being deleted. */
export interface TeamDeleteBlocker {
  tournament_name: string;
  tournament_slug: string;
  /** false: registered, the tournament has not started yet */
  running: boolean;
  /** the team can still leave it */
  registration_open: boolean;
}

export interface Team {
  id: string;
  name: string;
  max_size: number;
  members: TeamMember[];
  is_complete: boolean;
  /** Empty: the team can be deleted. Renaming is always possible; started tournaments keep the old name. */
  delete_blockers: TeamDeleteBlocker[];
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
/** What is played; it decides how a result is entered (see lib/games). */
export enum Game {
  BEERPONG = "beerpong",
  FOOTBALL = "football",
}

/** How the teams meet. Only the modes the API has; the coming ones live in lib/modes. */
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
  /** A deleted link does not work any more; it stays with the invitations it brought. */
  deleted: boolean;
  /** Accounts that opened the link (each got an invitation) and how many of them play. */
  opened: number;
  joined: number;
}

/** What somebody sees of a tournament before taking part: the tournament, nothing about who plays. */
export interface TournamentPreview {
  tournament_id: string;
  slug: string;
  name: string;
  location: string | null;
  description: string | null;
  start_time: string | null;
  registration_open: boolean;
  join_policy: JoinPolicy;
  phase: TournamentPhase;
  team_count: number;
  /** Only a deadline that really closes the registration. */
  registration_end_time: string | null;
}

export type InvitationStatus = "pending" | "accepted" | "declined" | "withdrawn";

/** A personal invitation, as the invited person sees it. */
export interface Invitation {
  id: string;
  status: InvitationStatus;
  created_at: string;
  tournament: TournamentPreview;
  /** Invited directly by this person. */
  invited_by_name: string | null;
  /** Came from this link. */
  link_label: string | null;
  team_id: string | null;
  team_name: string | null;
}

/** A personal invitation, as the organization sees it. */
export interface TournamentInvitation {
  id: string;
  user_id: string;
  user_name: string;
  status: InvitationStatus;
  /** The link it came from; null: invited directly. */
  invite_id: string | null;
  invited_by_name: string | null;
  team_name: string | null;
  created_at: string;
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
  game: Game;
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

/** A station of a tournament: "Tisch 1", "Tisch 2", ... unless renamed. */
export interface Station {
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
  /** How many stations are created with the tournament; they are managed one by one afterwards. */
  station_count?: number;
  game: Game;
  mode: TournamentMode;
  visibility?: TournamentVisibility;
  join_policy?: JoinPolicy;
}

// ── Match & Bracket ───────────────────────────────────
export interface ParticipatingTournament {
  tournament: Tournament;
  team: Team;
  is_checked_in: boolean;
  /** The team's next match that is not finished (once started). */
  next_match: Match | null;
  /** Out or won: the place (1 = winner). */
  place: number | null;
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
 * Decided by the API: waiting (a team is still in another match), queued (waiting for a free station),
 * ready (at its station, not started), live (started), finished (has a result).
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
  /** The station it is played at (kept once it is finished); null while it has none. Decided by the API. */
  station_id: string | null;
  station_name: string | null;
  /** A ready match without a station: its place in the queue for the next free station (1 = next). */
  queue_position: number | null;
  /** A match still waiting for a team whose station is already certain (towards the end, when nothing queues). */
  upcoming_station_id: string | null;
  upcoming_station_name: string | null;
  /** Since when it is at its station (ready or live). */
  on_station_at: string | null;
  /** When it was started at its station (only while live). */
  started_at: string | null;
  created_at: string;
  status: MatchStatus;
  winner_team_id: string | null;
  /** The score of each team (what it counts is up to the game: cups left, goals); null before the result. */
  score_a: number | null;
  score_b: number | null;
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
  /** null for a deletion */
  score_a: number | null;
  score_b: number | null;
  reported_by_user_id: string;
  reported_by_username?: string;
  created_at: string;
}

/** A result as it is reported: the winner and the score of both teams of the match. */
export interface ReportedResult {
  winnerTeamId: string;
  scoreA: number;
  scoreB: number;
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
