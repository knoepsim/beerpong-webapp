"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BracketView } from "@/components/bracket-view";
import { MatchList } from "@/components/match-list";
import { StandingsTable } from "@/components/standings-table";
import { groupLetter } from "@/lib/groups";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Bracket, Match, Team } from "@/types";

interface ScheduleProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  /** Referees, managers and admins open a match to start it or enter its result. */
  onMatchClick?: (match: Match) => void;
  /** Group stage: how many of each group go on (marked in its table). */
  advance?: number;
}

const finished = (match: Match) => match.status === "finished";

/** What is still open, the finished matches when asked for (not in the way); with `group` those of one group. */
function OpenAndFinished(props: Readonly<ScheduleProps & { group?: number }>) {
  const mine = props.bracket.matches.filter((m) => (props.group ? m.group === props.group : m.group === null));
  const done = mine.filter(finished).length;
  const open = mine.length - done;
  return (
    <div className="space-y-5">
      {open > 0 ? (
        <MatchList {...props} include={(m) => !finished(m)} />
      ) : (
        <p className="text-sm text-muted-foreground">Alle Spiele sind gespielt.</p>
      )}
      {done > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group flex h-11 w-full items-center justify-between rounded-xl border bg-card px-3 text-sm font-medium">
            Beendete Spiele ({done})
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <MatchList {...props} include={finished} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

const HINT = "Tippe auf ein Spiel, um es zu starten oder das Ergebnis einzutragen.";

/**
 * Group stage and knock-out: the groups (table and matches of each) and the tree, one at a time; the tree first once
 * the knock-out runs. Before that its places name the groups ("1. Gruppe A").
 */
function GroupsAndKnockout(props: Readonly<ScheduleProps>) {
  const { bracket, teamsMap, highlightTeamId, onMatchClick, advance } = props;
  const [phase, setPhase] = useState(bracket.knockout_started ? "knockout" : "groups");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={phase} onValueChange={(value) => setPhase(String(value))}>
          <TabsList aria-label="Phase">
            <TabsTrigger value="groups">Gruppen</TabsTrigger>
            <TabsTrigger value="knockout">K.-o.-Runde</TabsTrigger>
          </TabsList>
        </Tabs>
        {onMatchClick && <p className="text-sm text-muted-foreground">{HINT}</p>}
      </div>
      {phase === "groups" ? (
        <div className="space-y-8">
          {bracket.groups!.map((g) => (
            <section key={g.group} aria-labelledby={`group-${g.group}`} className="space-y-3">
              <h3 id={`group-${g.group}`} className="font-semibold">
                Gruppe {groupLetter(g.group)}
              </h3>
              <StandingsTable standings={g.standings} teamsMap={teamsMap} highlightTeamId={highlightTeamId} advance={advance} />
              <OpenAndFinished {...props} group={g.group} />
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {!bracket.knockout_started && (
            <p className="text-sm text-muted-foreground">
              Die Plätze bekommen ihre Teams, wenn die Spielleitung nach den Gruppen die K.-o.-Runde startet.
            </p>
          )}
          <BracketView {...props} />
        </div>
      )}
    </div>
  );
}

/**
 * The schedule. A knock-out as a tree (the overview everybody knows from a tournament) or as a list of what is still
 * open (easy to read on a phone); everybody against everybody as its table and the matches day by day.
 */
export function Schedule(props: Readonly<ScheduleProps>) {
  const { bracket, teamsMap, highlightTeamId, onMatchClick } = props;
  const [view, setView] = useState("tree");

  if (bracket.groups) return <GroupsAndKnockout {...props} />;

  if (bracket.standings) {
    return (
      <div className="space-y-6">
        <StandingsTable standings={bracket.standings} teamsMap={teamsMap} highlightTeamId={highlightTeamId} />
        {onMatchClick && <p className="text-sm text-muted-foreground">{HINT}</p>}
        <OpenAndFinished {...props} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(value) => setView(String(value))}>
          <TabsList aria-label="Ansicht">
            <TabsTrigger value="tree">Baum</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>
        </Tabs>
        {onMatchClick && <p className="text-sm text-muted-foreground">{HINT}</p>}
      </div>
      {view === "tree" ? <BracketView {...props} /> : <OpenAndFinished {...props} />}
    </div>
  );
}
