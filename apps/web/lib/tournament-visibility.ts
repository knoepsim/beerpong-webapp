import { TournamentVisibility } from "@/types";

export interface VisibilityOption {
  value: TournamentVisibility;
  label: string;
  /** One line for the list of options. */
  summary: string;
  /** Who can find, see and join: said once, the same everywhere the option is chosen. */
  description: string;
}

export const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    value: TournamentVisibility.PUBLIC_LISTED,
    label: "Öffentlich",
    summary: "In der Liste, jeder kann beitreten",
    description: "Steht in der Turnierliste. Jeder kann ansehen und mit einem Team beitreten.",
  },
  {
    value: TournamentVisibility.PUBLIC_UNLISTED,
    label: "Nur mit Link",
    summary: "Nicht in der Liste, Link genügt",
    description: "Steht nicht in der Liste. Jeder, der den Turnierlink kennt, kann ansehen und beitreten.",
  },
  {
    value: TournamentVisibility.PRIVATE,
    label: "Privat",
    summary: "Nur mit Einladungslink",
    description: "Nur mit Einladungslink: Ohne ihn sehen nur Mitwirkende und Teilnehmer das Turnier und nur mit ihm kann man beitreten.",
  },
];

export const visibilityLabel = (value: TournamentVisibility): string =>
  VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
