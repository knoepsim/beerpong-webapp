import type { DefaultValues } from "react-hook-form";
import type { FormStep } from "@/components/form-steps";
import { z } from "zod";
import { scheduleToPayload, toIsoOrNull, validateSchedule } from "@/lib/tournament-schedule";
import { Game, JoinPolicy, TournamentMode, TournamentVisibility, type TournamentCreateRequest } from "@/types";

const scheduleSchema = z
  .object({
    start_time: z.string().min(1, "Bitte gib ein Startdatum und eine Startzeit an."),
    registration_end_time: z.string(),
    registration_auto_close: z.boolean(),
    checkin_enabled: z.boolean(),
    checkin_start_time: z.string(),
    checkin_auto_open: z.boolean(),
  })
  // the same rules as the settings and the API (lib/tournament-schedule)
  .superRefine((schedule, ctx) => {
    for (const [path, message] of Object.entries(validateSchedule(schedule))) {
      ctx.addIssue({ code: "custom", path: [path], message });
    }
  });

/** Everything a new tournament needs. Game and mode have no default: the organizer chooses them. */
export const newTournamentSchema = z.object({
  game: z.enum(Game, { error: "Wähle aus, was gespielt wird." }),
  mode: z.enum(TournamentMode, { error: "Wähle aus, wie gespielt wird." }),
  name: z.string().trim().min(3, "Der Name muss mindestens 3 Zeichen lang sein."),
  location: z.string(),
  description: z.string(),
  schedule: scheduleSchema,
  // the field gives a number (NaN when empty): no coercion, so what goes in is what comes out
  station_count: z.number({ error: "Gib eine Zahl an." }).int().min(1, "Mindestens 1.").max(100, "Höchstens 100."),
  visibility: z.enum(TournamentVisibility),
  join_policy: z.enum(JoinPolicy),
  // group stage and knock-out only (sent only for that mode)
  group_count: z.number({ error: "Gib die Zahl der Gruppen an." }).int().min(1, "Mindestens 1.").max(26, "Höchstens 26."),
  advance_per_group: z
    .number({ error: "Gib an, wie viele weiterkommen." })
    .int()
    .min(1, "Mindestens 1.")
    .max(16, "Höchstens 16."),
});

export type NewTournamentValues = z.infer<typeof newTournamentSchema>;

/** Game and mode stay open until they are chosen. */
export const NEW_TOURNAMENT_DEFAULTS: DefaultValues<NewTournamentValues> = {
  name: "",
  location: "",
  description: "",
  schedule: {
    start_time: "",
    registration_end_time: "",
    registration_auto_close: false,
    checkin_enabled: false,
    checkin_start_time: "",
    checkin_auto_open: false,
  },
  station_count: 1,
  group_count: 2,
  advance_per_group: 2,
  visibility: TournamentVisibility.PUBLIC,
  join_policy: JoinPolicy.OPEN,
};

/**
 * The schedule is one field of the form, but checked by the fields inside it: react-hook-form keeps the errors of a
 * nested object only for names below it ("schedule.start_time"), not for "schedule" as a whole.
 */
export const SCHEDULE_FIELDS = ["schedule.start_time", "schedule.registration_end_time", "schedule.checkin_start_time"] as const;

/**
 * The steps of the form, each with the fields it checks before going on. The structural choices come first:
 * what is played and how decides what is asked later.
 */
export const NEW_TOURNAMENT_STEPS = [
  { id: "spiel", title: "Spiel & Modus", fields: ["game", "mode"] },
  // only for group stage and knock-out (see newTournamentSteps)
  { id: "gruppen", title: "Gruppen", fields: ["group_count", "advance_per_group"] },
  { id: "turnier", title: "Turnier", fields: ["name", "location", "description"] },
  { id: "zeitplan", title: "Zeitplan", fields: SCHEDULE_FIELDS },
  // the title names the stations of the game ("Zugang & Tische"), see the form
  { id: "zugang", title: "Zugang & Spielstätten", fields: ["visibility", "join_policy", "station_count"] },
] as const satisfies readonly FormStep<NewTournamentValues>[];

export type NewTournamentStep = (typeof NEW_TOURNAMENT_STEPS)[number];

/** The steps for the chosen mode (the groups only for group stage and knock-out), the stations named by the game. */
export function newTournamentSteps(mode: TournamentMode | undefined, stations: string): NewTournamentStep[] {
  return NEW_TOURNAMENT_STEPS.filter((step) => step.id !== "gruppen" || mode === TournamentMode.GROUPS_KNOCKOUT).map(
    (step) => (step.id === "zugang" ? { ...step, title: `Zugang & ${stations}` } : step) as NewTournamentStep,
  );
}

export function toCreateRequest(values: NewTournamentValues): TournamentCreateRequest {
  return {
    game: values.game,
    mode: values.mode,
    name: values.name.trim(),
    location: values.location.trim() || undefined,
    description: values.description.trim() || undefined,
    start_time: toIsoOrNull(values.schedule.start_time)!,
    ...scheduleToPayload(values.schedule),
    station_count: values.station_count,
    ...(values.mode === TournamentMode.GROUPS_KNOCKOUT
      ? { group_count: values.group_count, advance_per_group: values.advance_per_group }
      : {}),
    visibility: values.visibility,
    join_policy: values.join_policy,
  };
}
