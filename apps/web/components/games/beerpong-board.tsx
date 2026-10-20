import { BeerpongTable } from "@/components/games/beerpong-table";
import type { GameBoardProps } from "@/components/games";

/** The cups on the table: the winner keeps what was left, the loser has none, before a winner both have all. */
export function BeerpongBoard({ winner, score, max }: Readonly<GameBoardProps>) {
  const left = winner === "b" ? 0 : winner === "a" ? score : max;
  const right = winner === "a" ? 0 : winner === "b" ? score : max;
  return <BeerpongTable leftCups={left} rightCups={right} compact className="w-full" />;
}
