import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchSlot } from "@/lib/bracket-layout";
import type { Team } from "@/types";

/** Team colors of a match: slot a plays red, slot b plays blue. */
const SIDES = {
  a: { label: "rot", stripe: "border-l-red-500", stripeMuted: "border-l-red-500/30", winnerBg: "bg-red-500/10" },
  b: { label: "blau", stripe: "border-l-blue-500", stripeMuted: "border-l-blue-500/30", winnerBg: "bg-blue-500/10" },
} as const;

type Side = keyof typeof SIDES;

interface TeamRowProps {
  side: Side;
  name: string | null;
  /** Shown while the team is not known yet: where it comes from. */
  placeholder: string;
  isWinner: boolean;
  isChampion: boolean;
  isLoser: boolean;
  isMine: boolean;
}

function TeamRow({ side, name, placeholder, isWinner, isChampion, isLoser, isMine }: TeamRowProps) {
  const colors = SIDES[side];
  return (
    <div
      className={cn(
        "flex items-center gap-1 min-h-8 px-1.5 py-1 border-t border-l-4 text-[13px] leading-tight",
        // the stripe stays strong until the match is decided, then only the winner keeps it
        isLoser || name === null ? colors.stripeMuted : colors.stripe,
        isMine ? "bg-primary/10" : isWinner && colors.winnerBg,
        isLoser && "text-muted-foreground",
      )}
    >
      {name === null ? (
        <span className="italic text-muted-foreground">{placeholder}</span>
      ) : (
        // long names wrap onto a second line instead of being cut off
        <span className="line-clamp-2 break-words" title={name}>
          {name}
        </span>
      )}
      {isChampion && <Trophy className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500" aria-label="Turniersieger" />}
      {isWinner && !isChampion && (
        <Check className="ml-auto w-3.5 h-3.5 shrink-0 text-green-700 dark:text-green-400" aria-label="Gewinner" />
      )}
    </div>
  );
}

interface MatchCardProps {
  slot: MatchSlot;
  teamsMap: Record<string, Team>;
  /** Only set for the final: the trophy belongs there. */
  championTeamId?: string | null;
  /** The team of the logged-in user, highlighted wherever it plays. */
  highlightTeamId?: string | null;
  onClick?: (slot: MatchSlot["match"]) => void;
}

const teamName = (teamsMap: Record<string, Team>, id: string | null) =>
  id === null ? null : teamsMap[id]?.name || "Unbekannt";

const placeholderFor = (source: number | null) => (source === null ? "Offen" : `Sieger Spiel ${source}`);

/** One match: number, status, and both teams. The state comes from the API, nothing is derived here. */
export function MatchCard({ slot, teamsMap, championTeamId, highlightTeamId, onClick }: MatchCardProps) {
  const { match, number, sources } = slot;
  const finished = match.status === "finished";
  const mine = !!highlightTeamId && (match.team_a_id === highlightTeamId || match.team_b_id === highlightTeamId);

  const sides = (
    [
      { side: "a", id: match.team_a_id, source: sources.a },
      { side: "b", id: match.team_b_id, source: sources.b },
    ] as const
  ).map(({ side, id, source }) => ({
    side,
    id,
    name: teamName(teamsMap, id),
    placeholder: placeholderFor(source),
    isWinner: finished && id !== null && id === match.winner_team_id,
    isChampion: id !== null && id === championTeamId,
  }));

  const summary = [
    `Spiel ${number}`,
    // the colors are part of the information, so they are spoken as well
    sides.map((s) => `${s.name ?? s.placeholder} (${SIDES[s.side].label})`).join(" gegen "),
    match.status === "ready" ? "bereit" : null,
    finished ? `beendet, Sieger ${teamName(teamsMap, match.winner_team_id) ?? "unbekannt"}` : null,
    finished && match.cups_left != null ? `${match.cups_left} Becher übrig` : null,
    match.table_number != null ? `Tisch ${match.table_number}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const className = cn(
    "w-full rounded-lg border bg-card text-left shadow-xs overflow-hidden",
    // what can be played right now stands out
    match.status === "ready" && "border-primary/50",
    mine && "ring-2 ring-primary/60",
    onClick && "cursor-pointer hover:border-primary/50 hover:shadow-md transition-shadow",
  );
  const content = (
    <>
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1 text-xs leading-4 text-muted-foreground">
        <span className="truncate">
          Spiel {number}
          {match.table_number != null && ` · Tisch ${match.table_number}`}
        </span>
        {match.status === "ready" && (
          <span className="inline-flex items-center gap-1 shrink-0 font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Bereit
          </span>
        )}
        {finished && (
          <span className="shrink-0" title="Becher, die dem Sieger übrig blieben">
            {match.cups_left != null ? `${match.cups_left} Becher` : "Beendet"}
          </span>
        )}
      </div>
      {sides.map((side, i) => (
        <TeamRow
          key={i}
          side={side.side}
          name={side.name}
          placeholder={side.placeholder}
          isWinner={side.isWinner}
          isChampion={side.isChampion}
          isLoser={finished && !side.isWinner && side.id !== null}
          isMine={!!highlightTeamId && side.id === highlightTeamId}
        />
      ))}
    </>
  );

  return onClick ? (
    <button type="button" className={className} aria-label={summary} onClick={() => onClick(match)}>
      {content}
    </button>
  ) : (
    <div className={className} role="group" aria-label={summary}>
      {content}
    </div>
  );
}

/** A team that skips round one. It has no match, so it gets a slim card of its own. */
export function ByeCard({ teamId, teamsMap, highlightTeamId }: { teamId: string; teamsMap: Record<string, Team>; highlightTeamId?: string | null }) {
  const mine = !!highlightTeamId && teamId === highlightTeamId;
  const name = teamName(teamsMap, teamId);
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-dashed bg-card/60 px-2 py-1.5 text-[13px] leading-none",
        mine && "ring-2 ring-primary/60 bg-primary/10",
      )}
      role="group"
      aria-label={`${name}, Freilos: ohne Spiel direkt in der nächsten Runde`}
    >
      <p className="text-[11px] leading-4 text-muted-foreground">Freilos</p>
      <p className="truncate font-medium pt-1">{name}</p>
    </div>
  );
}
