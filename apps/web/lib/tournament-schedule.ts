/**
 * Time settings of a tournament as they are edited in a form: `datetime-local` strings
 * ("" = not set). The same rules are enforced by the API (apps/api/app/services/schedule.py).
 */
export interface ScheduleValues {
  start_time: string;
  registration_end_time: string;
  /** Close the registration by itself at the deadline. */
  registration_auto_close: boolean;
  checkin_enabled: boolean;
  checkin_start_time: string;
  /** Open check-in by itself at its start time. */
  checkin_auto_open: boolean;
}

export type ScheduleErrors = Partial<
  Record<"start_time" | "registration_end_time" | "checkin_start_time", string>
>;

const time = (value: string) => (value ? new Date(value).getTime() : null);

/** Deadline and check-in start lie before the start; they may overlap (late teams can still register). */
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

/**
 * Fields of the API for a schedule form. An automation needs its time and check-in needs to be switched on,
 * so a time that is empty (or belongs to a disabled check-in) never carries an automation.
 */
export function scheduleToPayload(values: ScheduleValues) {
  const registrationEnd = toIsoOrNull(values.registration_end_time);
  const checkinStart = values.checkin_enabled ? toIsoOrNull(values.checkin_start_time) : null;
  return {
    registration_end_time: registrationEnd,
    registration_auto_close: registrationEnd !== null && values.registration_auto_close,
    checkin_enabled: values.checkin_enabled,
    checkin_start_time: checkinStart,
    checkin_auto_open: checkinStart !== null && values.checkin_auto_open,
  };
}
