import type { ComponentType } from "react";
import { BeerpongResult } from "@/components/games/beerpong-result";
import { FootballResult } from "@/components/games/football-result";
import type { ModeId } from "@/lib/modes";
import { Game, TournamentMode, type ReportedResult } from "@/types";

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
  /** A draw is a result here (the game has draws and the mode counts points). */
  allowDraw: boolean;
  /** Every change; null while the entry is not complete (or not possible). */
  onChange: (result: ReportedResult | null) => void;
}

/**
 * The word for where a match is played (a table, a pitch), in the forms the texts need. The API names the stations
 * with the same word ("Tisch 3", "Platz 3", app/games.py).
 */
export interface StationTerms {
  singular: string;
  plural: string;
  /** With the indefinite article in the accusative: "einen Tisch". */
  accusative: string;
  /** Negated: "keinen Tisch". */
  none: string;
  /** With the indefinite article: "ein Tisch". */
  nominative: string;
  /** With the indefinite article in the dative: "einem Tisch". */
  dative: string;
  /** With the possessive in the dative: "deinem Tisch". */
  yours: string;
}

/** Before a game is chosen (and outside of a tournament): the neutral word. */
export const STATION_TERMS: StationTerms = {
  singular: "Spielstätte",
  plural: "Spielstätten",
  accusative: "eine Spielstätte",
  none: "keine Spielstätte",
  nominative: "eine Spielstätte",
  dative: "einer Spielstätte",
  yours: "deiner Spielstätte",
};

/** Everything that differs from game to game. A new game is a new entry here with its result input. */
export interface GameDefinition {
  id: Game;
  label: string;
  /** An example name for a new tournament. */
  namePlaceholder: string;
  station: StationTerms;
  /** The modes a tournament of this game can have, the coming ones included (lib/modes says which are there). */
  modes: ModeId[];
  /** A match can end even (only in a mode without a winner of every match, lib/modes DRAW_MODES). */
  draws: boolean;
  ResultInput: ComponentType<ResultInputProps>;
}

const ALL_MODES: ModeId[] = [TournamentMode.SINGLE_ELIMINATION, TournamentMode.ROUND_ROBIN, TournamentMode.GROUPS_KNOCKOUT];

export const GAMES: Record<Game, GameDefinition> = {
  [Game.BEERPONG]: {
    id: Game.BEERPONG,
    label: "Bierpong",
    namePlaceholder: "z. B. Sommerfest-Bierpong",
    station: { singular: "Tisch", plural: "Tische", accusative: "einen Tisch", none: "keinen Tisch", nominative: "ein Tisch", dative: "einem Tisch", yours: "deinem Tisch" },
    modes: ALL_MODES,
    draws: false,
    ResultInput: BeerpongResult,
  },
  [Game.FOOTBALL]: {
    id: Game.FOOTBALL,
    label: "Fußball",
    namePlaceholder: "z. B. Kleinfeld-Cup",
    station: { singular: "Platz", plural: "Plätze", accusative: "einen Platz", none: "keinen Platz", nominative: "ein Platz", dative: "einem Platz", yours: "deinem Platz" },
    modes: ALL_MODES,
    draws: true,
    ResultInput: FootballResult,
  },
};

/** All games, sorted by name (the order of the picker). */
export const GAME_LIST: GameDefinition[] = Object.values(GAMES).toSorted((a, b) => a.label.localeCompare(b.label, "de"));

/** The same result: winner and both scores. */
export const sameResult = (a: ReportedResult | null, b: ReportedResult | null) =>
  a?.winnerTeamId === b?.winnerTeamId && a?.scoreA === b?.scoreA && a?.scoreB === b?.scoreB;
