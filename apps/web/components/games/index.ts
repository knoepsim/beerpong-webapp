import type { ComponentType } from "react";
import { BeerpongBoard } from "@/components/games/beerpong-board";
import { Game } from "@/types";

/**
 * What the winner reports beside winning: one number with its limits (beer pong: the cups that are left).
 * The API keeps it as `cups_left`; a game with another kind of result needs its own field there.
 */
export interface GameScore {
  label: string;
  min: number;
  max: number;
  /** Counts when nothing is entered: what the field shows as its placeholder is what is saved. */
  fallback: number;
  format: (value: number) => string;
}

export interface GameBoardProps {
  /** Side of the winner, null before one is chosen. */
  winner: "a" | "b" | null;
  /** The winner's score. */
  score: number;
  max: number;
}

/** Everything that differs from game to game. A new game is a new entry here with its board. */
export interface GameDefinition {
  id: Game;
  label: string;
  /** An example name for a new tournament. */
  namePlaceholder: string;
  score: GameScore;
  /** The picture of the match while its result is entered. */
  Board: ComponentType<GameBoardProps>;
}

export const GAMES: Record<Game, GameDefinition> = {
  [Game.BEERPONG]: {
    id: Game.BEERPONG,
    label: "Bierpong",
    namePlaceholder: "z. B. Sommerfest-Bierpong",
    score: { label: "Übrige Becher", min: 1, max: 10, fallback: 10, format: (n) => `${n} Becher` },
    Board: BeerpongBoard,
  },
};

/** All games, sorted by name (the order of the picker). */
export const GAME_LIST: GameDefinition[] = Object.values(GAMES).toSorted((a, b) => a.label.localeCompare(b.label, "de"));
