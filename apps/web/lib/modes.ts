import { TournamentMode } from "@/types";

/** The modes: the ones the API has (a coming one would be shown, but not to choose). */
export type ModeId = TournamentMode;

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
    id: TournamentMode.ROUND_ROBIN,
    label: "Jeder gegen jeden",
    description: "Alle spielen gegen alle, die Tabelle entscheidet.",
    available: true,
  },
  {
    id: TournamentMode.GROUPS_KNOCKOUT,
    label: "Gruppenphase und K.-o.-System",
    description: "Erst in Gruppen jeder gegen jeden, die Besten spielen im K.-o.-System weiter.",
    available: true,
  },
];

export const modeLabel = (id: ModeId) => MODES.find((mode) => mode.id === id)?.label ?? id;

/** The modes in which a match may end even: everybody against everybody counts points, a knock-out needs a winner. */
export const DRAW_MODES: TournamentMode[] = [TournamentMode.ROUND_ROBIN];
