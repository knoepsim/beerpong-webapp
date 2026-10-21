"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ByeCard, MatchCard } from "@/components/match-card";
import { activeRounds, buildBracketLayout, focusRound, isAdvanced, roundTitle, type BracketSlot } from "@/lib/bracket-layout";
import { cn } from "@/lib/utils";
import type { Bracket, Match, Team } from "@/types";

/** Height of one slot of the first round; every later round doubles it. A card (one-line names) plus a small gap. */
const SLOT_HEIGHT = 92;
/** Space between two columns, split in half for each side (the lines run through it). */
const GUTTER = 20;
const HALF_GUTTER = GUTTER / 2;
/** Lines of upcoming matches are light, lines of teams that have moved on are dark: the path reads like a story. */
const lineColor = (done: boolean) => (done ? "border-foreground/50" : "border-muted-foreground/30");

/** Stable key of a slot: the match or team in it, not its place in the list. */
const slotKey = (round: number, slot: BracketSlot, position: number) => {
  if (slot.kind === "match") return slot.match.id;
  return slot.kind === "bye" ? `bye-${slot.teamId}` : `empty-${round}-${position}`;
};

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
}: Readonly<{
  position: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** The team of this slot has moved on: its outgoing line is drawn dark. */
  advanced: boolean;
  /** At least one of the two slots feeding this match has moved on. */
  incomingAdvanced: boolean;
  children: ReactNode;
}>) {
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
}: Readonly<{
  slot: BracketSlot;
  teamsMap: Record<string, Team>;
  championTeamId: string | null;
  highlightTeamId?: string | null;
  onMatchClick?: (match: Match) => void;
}>) {
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
 * to them by lines. All rounds are shown; the tree scrolls sideways only, the page scrolls up and down.
 */
export function BracketView({ bracket, teamsMap, onMatchClick, highlightTeamId }: Readonly<BracketViewProps>) {
  const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);
  const scroller = useRef<HTMLDivElement>(null);
  const rounds = useRef(new Map<number, HTMLElement>());
  const focused = useRef(false);
  const focus = focusRound(layout, highlightTeamId);

  // open at the round that matters (my next match, else what is played now) once; live updates do not jump around
  useEffect(() => {
    const section = rounds.current.get(focus);
    if (focused.current || !scroller.current || !section) return;
    focused.current = true;
    scroller.current.scrollLeft = section.offsetLeft - scroller.current.offsetLeft;
  }, [focus]);

  if (layout.totalRounds === 0) return null;

  const treeHeight = 2 ** (layout.totalRounds - 1) * SLOT_HEIGHT;
  const active = activeRounds(layout);

  return (
    // One grey surface behind the whole tree; the cards stand out in white and the lines show the structure.
    // It bleeds into the padding of the surrounding card so two columns fit on a phone.
    <div className="-mx-4 bg-muted">
      <div
        ref={scroller}
        className="relative overflow-x-auto snap-x snap-proximity px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ ["--col" as string]: "clamp(150px, 42vw, 210px)" }}
      >
        <div className="flex w-max">
          {layout.rounds.map((round, index) => {
            const isFirst = index === 0;
            const isLast = round.round === layout.totalRounds;
            const previous = index > 0 ? layout.rounds[index - 1] : undefined;
            return (
              <section
                key={round.round}
                ref={(el) => {
                  if (el) rounds.current.set(round.round, el);
                  else rounds.current.delete(round.round);
                }}
                aria-label={roundTitle(layout, round.round)}
                className="snap-start shrink-0 flex flex-col"
                style={{ width: `calc(var(--col) + ${GUTTER}px)` }}
              >
                <header
                  className={cn(
                    "mb-1 h-12 flex flex-col justify-center rounded-md px-3",
                    // rounds with matches that can be played right now stand out; neighbours read as one band
                    active.has(round.round) && "bg-primary/10 text-primary",
                    active.has(round.round) && active.has(round.round - 1) && "rounded-l-none",
                    active.has(round.round) && active.has(round.round + 1) && "rounded-r-none",
                  )}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider">
                    {roundTitle(layout, round.round)}
                  </h3>
                  {active.has(round.round) && (
                    <p className="flex items-center gap-1 text-xs font-medium">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      Aktuell
                    </p>
                  )}
                </header>
                <div className="flex flex-col" style={{ height: treeHeight }}>
                  {round.slots.map((slot, position) => (
                    <Slot
                      key={slotKey(round.round, slot, position)}
                      position={position}
                      hasNext={!isLast && slot.kind !== "empty"}
                      hasPrev={!isFirst && slot.kind === "match"}
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
  );
}
