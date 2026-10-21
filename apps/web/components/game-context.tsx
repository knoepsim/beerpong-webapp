"use client";

import { createContext, useContext, type ReactNode } from "react";
import { GAMES, STATION_TERMS, type GameDefinition, type StationTerms } from "@/components/games";
import type { Game } from "@/types";

const GameContext = createContext<GameDefinition | null>(null);

/** The game of the tournament on the page: what its parts call a station, how a result is entered. */
export function GameProvider({ game, children }: Readonly<{ game: Game; children: ReactNode }>) {
  return <GameContext.Provider value={GAMES[game]}>{children}</GameContext.Provider>;
}

/** The game of the tournament on the page; null outside of one. */
export function useGame(): GameDefinition | null {
  return useContext(GameContext);
}

/** The word for a station in this tournament; outside of one the neutral "Spielstätte". */
export function useStationTerms(): StationTerms {
  return useContext(GameContext)?.station ?? STATION_TERMS;
}
