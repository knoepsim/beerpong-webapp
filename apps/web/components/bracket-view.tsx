"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ByeCard, MatchCard } from "@/components/match-card";
import { buildBracketLayout, currentRound, defaultFirstRound, isAdvanced, type BracketSlot } from "@/lib/bracket-layout";
import { cn, roundLabel } from "@/lib/utils";
import type { Bracket, Match, Team } from "@/types";

/** Height of one slot of the first visible round; later rounds double it. */
const SLOT_HEIGHT = 112;
/** Space between two columns, split in half for each side (the lines run through it). */
const GUTTER = 20;
const HALF_GUTTER = GUTTER / 2;
/** Lines of upcoming matches are light, lines of teams that have moved on are dark: the path reads like a story. */
const lineColor = (done: boolean) => (done ? "border-foreground/50" : "border-muted-foreground/30");

interface BracketViewProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  onMatchClick?: (match: Match) => void;
  /** Team of the logged-in user, highlighted wherever it plays. */
  highlightTeamId?: string | null;
}

/** One slot of a column with the lines that connect it to the match it feeds and to the matches that feed it. */
function Slot({
  position,
  hasNext,
  hasPrev,
  advanced,
  incomingAdvanced,
  children,
}: {
  position: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** The team of this slot has moved on: its outgoing line is drawn dark. */
  advanced: boolean;
  /** At least one of the two slots feeding this match has moved on. */
  incomingAdvanced: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center min-h-0" style={{ paddingInline: HALF_GUTTER }}>
      <div className="relative w-full">
        {children}
        {hasPrev && (
          <span
            aria-hidden="true"
            data-line={incomingAdvanced ? "done" : "pending"}
            className={cn("absolute right-full top-1/2 border-t-2", lineColor(incomingAdvanced))}
            style={{ width: HALF_GUTTER }}
          />
        )}
        {hasNext && (
          <span
            aria-hidden="true"
            data-line={advanced ? "done" : "pending"}
            className={cn("absolute left-full top-1/2 border-t-2", lineColor(advanced))}
            style={{ width: HALF_GUTTER }}
          />
        )}
      </div>
      {hasNext && (
        // joins the stubs of the two slots that feed the same match: top child goes down, bottom child goes up
        <span
          aria-hidden="true"
          data-line={advanced ? "done" : "pending"}
          className={cn("absolute right-0 h-1/2 border-r-2", lineColor(advanced), position % 2 === 0 ? "top-1/2" : "top-0")}
        />
      )}
    </div>
  );
}

function SlotContent({
  slot,
  teamsMap,
  championTeamId,
  highlightTeamId,
  onMatchClick,
}: {
  slot: BracketSlot;
  teamsMap: Record<string, Team>;
  championTeamId: string | null;
  highlightTeamId?: string | null;
  onMatchClick?: (match: Match) => void;
}) {
  if (slot.kind === "empty") return null;
  if (slot.kind === "bye") return <ByeCard teamId={slot.teamId} teamsMap={teamsMap} highlightTeamId={highlightTeamId} />;
  return (
    <MatchCard
      slot={slot}
      teamsMap={teamsMap}
      championTeamId={championTeamId}
      highlightTeamId={highlightTeamId}
      onClick={onMatchClick}
    />
  );
}

/**
 * Single-elimination bracket as a tree: every match sits between the two matches that feed it and is connected
 * to them by lines. Finished early rounds are hidden by default, which also makes the tree much shorter.
 */
export function BracketView({ bracket, teamsMap, onMatchClick, highlightTeamId }: BracketViewProps) {
  const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);
  const [chosenFirstRound, setChosenFirstRound] = useState<number | null>(null);

  if (layout.totalRounds === 0) return null;

  const lastChoice = Math.max(1, layout.totalRounds - 1);
  const firstRound = Math.min(Math.max(chosenFirstRound ?? defaultFirstRound(layout), 1), lastChoice);
  const visible = layout.rounds.filter((r) => r.round >= firstRound);
  const hidden = layout.rounds.filter((r) => r.round < firstRound);
  const hiddenMatches = hidden.reduce((sum, r) => sum + r.matchCount, 0);
  const treeHeight = 2 ** (layout.totalRounds - firstRound) * SLOT_HEIGHT;
  const playing = currentRound(layout);

  return (
    <div className="space-y-3">
      {layout.totalRounds > 2 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Anzeigen ab</p>
          <div role="group" aria-label="Erste angezeigte Runde" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {layout.rounds.slice(0, lastChoice).map((r) => (
              <Button
                key={r.round}
                type="button"
                size="sm"
                variant={r.round === firstRound ? "default" : "outline"}
                aria-pressed={r.round === firstRound}
                className="h-9 shrink-0"
                onClick={() => setChosenFirstRound(r.round)}
              >
                {roundLabel(r.round, layout.totalRounds)}
              </Button>
            ))}
          </div>
          {hidden.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {hiddenMatches} {hiddenMatches === 1 ? "Spiel" : "Spiele"} aus früheren Runden ausgeblendet.
            </p>
          )}
        </div>
      )}

      {/* One grey surface behind the whole tree; the cards stand out in white and the lines show the structure.
          Bleeds into the padding of the surrounding card so two columns fit on a phone. The viewer scrolls on
          its own when the tree is tall, which keeps the round headers in view. */}
      <div className="-mx-4 bg-muted">
        <div
          className="max-h-[calc(100dvh-9rem)] overflow-auto snap-x snap-proximity px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ ["--col" as string]: "clamp(130px, 38vw, 200px)" }}
        >
          <div className="flex w-max">
            {visible.map((round, index) => {
              const isFirstVisible = round.round === firstRound;
              const isLast = round.round === layout.totalRounds;
              const previous = index > 0 ? visible[index - 1] : undefined;
              return (
                <section
                  key={round.round}
                  aria-label={roundLabel(round.round, layout.totalRounds)}
                  className="snap-start shrink-0 flex flex-col"
                  style={{ width: `calc(var(--col) + ${GUTTER}px)` }}
                >
                  <header className="sticky top-0 z-10 h-14 flex flex-col justify-center px-3 bg-muted">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                      {roundLabel(round.round, layout.totalRounds)}
                      {round.round === playing && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium normal-case tracking-normal text-primary">
                          Aktuell
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {round.finishedCount} von {round.matchCount} beendet
                    </p>
                  </header>
                  <div className="flex flex-col" style={{ height: treeHeight }}>
                    {round.slots.map((slot, position) => (
                      <Slot
                        key={position}
                        position={position}
                        hasNext={!isLast && slot.kind !== "empty"}
                        hasPrev={!isFirstVisible && slot.kind === "match"}
                        advanced={isAdvanced(slot)}
                        incomingAdvanced={
                          !!previous && [2 * position, 2 * position + 1].some((i) => isAdvanced(previous.slots[i]))
                        }
                      >
                        <SlotContent
                          slot={slot}
                          teamsMap={teamsMap}
                          championTeamId={isLast ? bracket.champion_team_id : null}
                          highlightTeamId={highlightTeamId}
                          onMatchClick={onMatchClick}
                        />
                      </Slot>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
