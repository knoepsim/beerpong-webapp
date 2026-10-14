import { Check, Clock, Hash, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Match, Team } from "@/types";

interface TeamRowProps {
  name: string;
  isWinner: boolean;
  isChampion: boolean;
  isDecided: boolean;
  tone: "red" | "blue";
}

const TONES = {
  red: { stripe: "bg-red-500", stripeMuted: "bg-red-500/30", winnerBg: "bg-red-500/5" },
  blue: { stripe: "bg-blue-500", stripeMuted: "bg-blue-500/30", winnerBg: "bg-blue-500/5" },
};

function TeamRow({ name, isWinner, isChampion, isDecided, tone }: TeamRowProps) {
  const colors = TONES[tone];
  const emphasis = isChampion
    ? "bg-primary/10 font-bold text-foreground"
    : isWinner
      ? `${colors.winnerBg} font-semibold text-foreground`
      : isDecided
        ? "text-muted-foreground"
        : "text-foreground";

  return (
    <div className={`flex items-center h-[40px] transition-colors ${emphasis}`}>
      <div className={`w-1 h-full shrink-0 ${isWinner ? colors.stripe : colors.stripeMuted}`} />
      <div className="flex items-center justify-between flex-1 px-2.5 min-w-0">
        <span className="truncate pr-2 text-sm">{name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isChampion && <Trophy className="w-3.5 h-3.5 text-amber-500" aria-label="Turniersieger" />}
          {isWinner && !isChampion && (
            <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" aria-label="Gewinner" />
          )}
        </div>
      </div>
    </div>
  );
}

interface MatchCardProps {
  match: Match;
  teamsMap: Record<string, Team>;
  championTeamId?: string | null;
  onClick?: (match: Match) => void;
}

const teamName = (teamsMap: Record<string, Team>, id: string | null) =>
  id ? teamsMap[id]?.name || "Unbekannt" : "TBD";

/** One match with the real state from the API: status, winner, cups left and table. */
export function MatchCard({ match, teamsMap, championTeamId, onClick }: MatchCardProps) {
  const isFinished = match.status === "finished";
  const showMeta = match.status !== "waiting";
  const isChampion = (id: string | null) => !!id && id === championTeamId;

  return (
    <div className="relative flex flex-col justify-center py-2">
      {showMeta && (
        <div className="flex items-center justify-between px-1 mb-1 gap-1">
          <div>
            {match.table_number != null && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal text-muted-foreground">
                <Hash className="w-2.5 h-2.5" aria-hidden="true" />
                Tisch {match.table_number}
              </Badge>
            )}
          </div>
          {isFinished ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal">
              <Check className="w-2.5 h-2.5" aria-hidden="true" />
              Beendet
              {match.cups_left != null && (
                <span title="Becher, die dem Sieger übrig blieben"> · {match.cups_left} Becher</span>
              )}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal text-muted-foreground">
              <Clock className="w-2.5 h-2.5" aria-hidden="true" />
              Bereit
            </Badge>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onClick?.(match)}
        className={`w-full flex flex-col text-left rounded-lg border overflow-hidden text-sm bg-card transition-all shadow-sm ${
          onClick ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="border-b">
          <TeamRow
            name={teamName(teamsMap, match.team_a_id)}
            isWinner={isFinished && match.winner_team_id === match.team_a_id}
            isChampion={isChampion(match.team_a_id)}
            isDecided={isFinished}
            tone="red"
          />
        </div>
        <TeamRow
          name={teamName(teamsMap, match.team_b_id)}
          isWinner={isFinished && match.winner_team_id === match.team_b_id}
          isChampion={isChampion(match.team_b_id)}
          isDecided={isFinished}
          tone="blue"
        />
      </button>
    </div>
  );
}
