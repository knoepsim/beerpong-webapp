import type { ComponentType } from "react";
import { BeerpongResult } from "@/components/games/beerpong-result";
import { FootballResult } from "@/components/games/football-result";
import { Game, type ReportedResult } from "@/types";

export interface TeamBasic {
  id: string;
  name: string;
}

/**
 * How the result of a match is entered. Every game gives the same thing in the end: the winner and the score of
 * both teams (score_a, score_b); how it is asked for is up to the game. The API checks the same rules (app/games.py).
 */
export interface ResultInputProps {
  teamA: TeamBasic;
  teamB: TeamBasic;
  /** The saved result to start from; null for a new one. */
  initial: ReportedResult | null;
  /** The next match has a result already: nothing can be changed. */
  locked: boolean;
  /** Every change; null while the entry is not complete (or not possible). */
  onChange: (result: ReportedResult | null) => void;
}

/** Everything that differs from game to game. A new game is a new entry here with its result input. */
export interface GameDefinition {
  id: Game;
  label: string;
  /** An example name for a new tournament. */
  namePlaceholder: string;
  ResultInput: ComponentType<ResultInputProps>;
}

export const GAMES: Record<Game, GameDefinition> = {
  [Game.BEERPONG]: {
    id: Game.BEERPONG,
    label: "Bierpong",
    namePlaceholder: "z. B. Sommerfest-Bierpong",
    ResultInput: BeerpongResult,
  },
  [Game.FOOTBALL]: {
    id: Game.FOOTBALL,
    label: "Fußball",
    namePlaceholder: "z. B. Kleinfeld-Cup",
    ResultInput: FootballResult,
  },
};

/** All games, sorted by name (the order of the picker). */
export const GAME_LIST: GameDefinition[] = Object.values(GAMES).toSorted((a, b) => a.label.localeCompare(b.label, "de"));

/** The same result: winner and both scores. */
export const sameResult = (a: ReportedResult | null, b: ReportedResult | null) =>
  a?.winnerTeamId === b?.winnerTeamId && a?.scoreA === b?.scoreA && a?.scoreB === b?.scoreB;
