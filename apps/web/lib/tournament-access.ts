import { JoinPolicy, TournamentVisibility } from "@/types";

export interface AccessOption<T extends string> {
  value: T;
  label: string;
  /** One line for the list of options. */
  summary: string;
  /** What it means exactly: said once, the same everywhere the option is chosen. */
  description: string;
}

/** Who sees bracket and results (the address /t/{slug} is shown to everybody who knows it). */
export const VISIBILITY_OPTIONS: AccessOption<TournamentVisibility>[] = [
  {
    value: TournamentVisibility.PUBLIC,
    label: "Öffentlich",
    summary: "Jeder sieht Spielplan und Ergebnisse",
    description: "Jeder mit dem Link sieht Spielplan, Ergebnisse und Teams.",
  },
  {
    value: TournamentVisibility.PRIVATE,
    label: "Privat",
    summary: "Nur Teilnehmer und Helfer",
    description: "Spielplan und Ergebnisse sehen nur Teilnehmer und Helfer. Fremde sehen nur Name, Zeit und Ort.",
  },
];

/** Who may join with a team. */
export const JOIN_OPTIONS: AccessOption<JoinPolicy>[] = [
  {
    value: JoinPolicy.OPEN,
    label: "Jeder mit dem Link",
    summary: "Der Turnierlink genügt",
    description: "Jeder, der den Turnierlink kennt, kann mit einem Team beitreten.",
  },
  {
    value: JoinPolicy.INVITE_ONLY,
    label: "Nur mit Einladungslink",
    summary: "Du verteilst Einladungslinks",
    description: "Beitreten kann nur, wer einen Einladungslink bekommen hat. Die Links verwaltest du unter den Einstellungen.",
  },
];

export const optionLabel = <T extends string>(options: AccessOption<T>[], value: T): string =>
  options.find((o) => o.value === value)?.label ?? value;
