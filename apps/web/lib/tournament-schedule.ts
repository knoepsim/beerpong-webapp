/**
 * Time settings of a tournament as they are edited in a form: `datetime-local` strings
 * ("" = not set). The same rules are enforced by the API (apps/api/app/services/schedule.py).
 */
export interface ScheduleValues {
  start_time: string;
  registration_end_time: string;
  checkin_enabled: boolean;
  checkin_start_time: string;
}

export type ScheduleErrors = Partial<
  Record<"start_time" | "registration_end_time" | "checkin_start_time", string>
>;

const time = (value: string) => (value ? new Date(value).getTime() : null);

/** Registration closes before check-in opens, and both happen before the start. */
export function validateSchedule(values: ScheduleValues): ScheduleErrors {
  const errors: ScheduleErrors = {};
  const start = time(values.start_time);
  const registrationEnd = time(values.registration_end_time);
  const checkinStart = values.checkin_enabled ? time(values.checkin_start_time) : null;

  if (registrationEnd !== null && start !== null && registrationEnd > start) {
    errors.registration_end_time = "Der Anmeldeschluss muss vor dem Turnierstart liegen.";
  }
  if (checkinStart !== null && start !== null && checkinStart > start) {
    errors.checkin_start_time = "Der Check-in muss vor dem Turnierstart beginnen.";
  } else if (checkinStart !== null && registrationEnd !== null && checkinStart < registrationEnd) {
    errors.checkin_start_time = "Der Check-in darf erst nach dem Anmeldeschluss beginnen.";
  }
  return errors;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** ISO timestamp from the API -> value for an `<input type="datetime-local">` in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value -> ISO timestamp for the API, `null` if empty. */
export function toIsoOrNull(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}
