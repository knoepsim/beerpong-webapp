import { z } from "zod";

/**
 * German mobile numbers only (015x, 016[023], 017x), entered without the +49 prefix.
 * Mirrors apps/api/app/core/phone.py: special-rate, landline, pager and foreign
 * numbers are rejected so SMS stay inside a standard German mobile flat rate.
 */
const GERMAN_MOBILE_NATIONAL = /^(15\d|16[023]|17\d)\d{7,8}$/;

export const GERMAN_MOBILE_ONLY_MESSAGE =
  "Nur deutsche Handynummern (+49 15x, 16x, 17x) werden unterstützt.";

/** Strip everything but digits and leading zeros from user input. */
export const toNationalDigits = (input: string) => input.replace(/\D/g, "").replace(/^0+/, "");

export const toE164 = (national: string) => `+49${national}`;

export const phoneSchema = z.object({
  phone: z.string().regex(GERMAN_MOBILE_NATIONAL, GERMAN_MOBILE_ONLY_MESSAGE),
});
