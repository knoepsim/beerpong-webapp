import { z } from "zod";

const name = z.string().trim().min(2, "Der Anzeigename muss mindestens 2 Zeichen lang sein.");
const email = z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse ein.");

/** Name and e-mail of the profile: the same rules wherever they are entered. */
export const profileSchema = z.object({ name, email: email.or(z.literal("")).optional() });

/** On the first start the e-mail is needed (it is the way back to the account). */
export const onboardingSchema = z.object({ name, email });
