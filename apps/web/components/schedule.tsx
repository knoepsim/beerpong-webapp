"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BracketView } from "@/components/bracket-view";
import { MatchList } from "@/components/match-list";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Bracket, Match, Team } from "@/types";

interface ScheduleProps {
  bracket: Bracket;
  teamsMap: Record<string, Team>;
  highlightTeamId?: string | null;
  /** Referees, managers and admins open a match to start it or enter its result. */
  onMatchClick?: (match: Match) => void;
}

const finished = (match: Match) => match.status === "finished";

/**
 * The schedule as a tree (the overview everybody knows from a tournament) or as a list of what is still open (easy
 * to read on a phone). Finished matches of the list are there when asked for, not in the way.
 */
export function Schedule({ bracket, teamsMap, highlightTeamId, onMatchClick }: Readonly<ScheduleProps>) {
  const [view, setView] = useState("tree");
  const done = bracket.matches.filter(finished).length;
  const open = bracket.matches.length - done;
  const listProps = { bracket, teamsMap, highlightTeamId, onMatchClick };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(value) => setView(String(value))}>
          <TabsList aria-label="Ansicht">
            <TabsTrigger value="tree">Baum</TabsTrigger>
            <TabsTrigger value="list">Liste</TabsTrigger>
          </TabsList>
        </Tabs>
        {onMatchClick && <p className="text-sm text-muted-foreground">Tippe auf ein Spiel, um es zu starten oder das Ergebnis einzutragen.</p>}
      </div>

      {view === "tree" ? (
        <BracketView {...listProps} />
      ) : (
        <div className="space-y-5">
          {open > 0 ? (
            <MatchList {...listProps} include={(m) => !finished(m)} />
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
                <MatchList {...listProps} include={finished} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
