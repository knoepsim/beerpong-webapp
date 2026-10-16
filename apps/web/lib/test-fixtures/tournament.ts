import { JoinPolicy, type Tournament, type TournamentTeam } from "@/types";

/** A tournament in its registration phase unless overridden. */
export const makeTournament = (overrides: Partial<Tournament> = {}): Tournament =>
  ({
    id: "t",
    name: "Cup",
    start_time: "2099-07-01T18:00:00Z",
    registration_end_time: null,
    registration_auto_close: false,
    checkin_enabled: false,
    checkin_start_time: null,
    checkin_auto_open: false,
    started_at: null,
    finished_at: null,
    phase: "registration",
    registration_open: true,
    checkin_open: false,
    join_policy: JoinPolicy.OPEN,
    ...overrides,
  }) as Tournament;

export const makeTournamentTeam = (overrides: Partial<TournamentTeam> = {}): TournamentTeam =>
  ({ id: "t4", name: "Team 4", members: [], is_checked_in: false, ...overrides }) as unknown as TournamentTeam;
