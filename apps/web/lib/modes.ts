import { TournamentMode } from "@/types";

/** The modes the API has, and the coming ones (not available yet: shown, but not to choose). */
export type ModeId = TournamentMode | "round_robin" | "groups_knockout";

export interface ModeDefinition {
  id: ModeId;
  label: string;
  description: string;
  available: boolean;
}

export const MODES: ModeDefinition[] = [
  {
    id: TournamentMode.SINGLE_ELIMINATION,
    label: "K.-o.-System",
    description: "Wer verliert, scheidet aus. Am Ende bleibt ein Sieger.",
    available: true,
  },
  {
    id: "round_robin",
    label: "Jeder gegen jeden",
    description: "Alle spielen gegen alle, die Tabelle entscheidet.",
    available: false,
  },
  {
    id: "groups_knockout",
    label: "Gruppenphase und K.-o.-System",
    description: "Erst in Gruppen jeder gegen jeden, die Besten spielen im K.-o.-System weiter.",
    available: false,
  },
];

export const modeLabel = (id: ModeId) => MODES.find((mode) => mode.id === id)?.label ?? id;
