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
  table_count: z.number({ error: "Gib die Zahl der Tische an." }).int().min(1, "Mindestens 1 Tisch.").max(100, "Maximal 100 Tische."),
  visibility: z.enum(TournamentVisibility),
  join_policy: z.enum(JoinPolicy),
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
  table_count: 1,
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
  { id: "turnier", title: "Turnier", fields: ["name", "location", "description"] },
  { id: "zeitplan", title: "Zeitplan", fields: SCHEDULE_FIELDS },
  { id: "zugang", title: "Zugang & Tische", fields: ["visibility", "join_policy", "table_count"] },
] as const satisfies readonly FormStep<NewTournamentValues>[];

export function toCreateRequest(values: NewTournamentValues): TournamentCreateRequest {
  return {
    game: values.game,
    mode: values.mode,
    name: values.name.trim(),
    location: values.location.trim() || undefined,
    description: values.description.trim() || undefined,
    start_time: toIsoOrNull(values.schedule.start_time)!,
    ...scheduleToPayload(values.schedule),
    table_count: values.table_count,
    visibility: values.visibility,
    join_policy: values.join_policy,
  };
}
