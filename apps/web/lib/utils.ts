import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const ROUND_NAMES = ["Finale", "Halbfinale", "Viertelfinale", "Achtelfinale"];

/** Name of a bracket round, counted back from the final: Finale, Halbfinale, ..., else "Runde n". */
export function roundLabel(round: number, totalRounds: number) {
  const fromFinal = totalRounds - round;
  return ROUND_NAMES[fromFinal] ?? `Runde ${round}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
