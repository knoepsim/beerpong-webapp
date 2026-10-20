"use client";

import { use, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShieldAlert, Trophy } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries/user";
import { useTournament } from "@/hooks/use-tournament";
import { useTournamentActions } from "@/hooks/use-tournament-actions";
import type { Match } from "@/types";
import { TournamentRoleType } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Schedule } from "@/components/schedule";
import { ParticipantStatus } from "@/components/participant-status";
import { StationsBoard } from "@/components/stations-board";
import { PodiumCard } from "@/components/podium-card";
import { TournamentSettings } from "@/components/tournament-settings";
import { TournamentTimeline } from "@/components/tournament-timeline";
import { TournamentHeader } from "@/components/tournament-header";
import { TournamentControlCard } from "@/components/tournament-control-card";
import { GameProvider } from "@/components/game-context";
import { GAMES } from "@/components/games";
import { TournamentTeamsTab } from "@/components/tournament-teams-tab";
import { JoinTournament } from "@/components/join-tournament";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { Markdown } from "@/components/markdown";
import { LoadError } from "@/components/load-error";
import { EmptyNote } from "@/components/empty-note";
import { ApiError } from "@/lib/api";
import { highestRole } from "@/lib/roles";
import { tabFromParam, tabQuery, type TournamentTab } from "@/lib/tournament-tabs";
import { cn } from "@/lib/utils";

// only referees, managers and admins open it: the dialog with the result input of the game is loaded then, not for everybody
const MatchResultDialog = dynamic(() => import("@/components/match-result-dialog").then((m) => m.MatchResultDialog), {
  ssr: false,
});

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4 max-w-sm" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>
  );
}

export default function TournamentDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}>) {
  const { slug } = use(params);
  const { tab: tabParam } = use(searchParams);
  const { user } = useCurrentUser();
  const { tournament, teams, teamsMap, roles, stations, bracket, preview, isLoading, error, retry, live } =
    useTournament(slug);
  const actions = useTournamentActions(tournament, teams);

  // the id: the dialog always shows the current state of the match (a live update changes it while it is open)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [tab, setTab] = useState<TournamentTab>(() => tabFromParam(tabParam));
  // the tab is part of the address: reload, back and shared links keep it (replace: tabs are no history steps)
  const changeTab = (next: string) => {
    const value = next as TournamentTab;
    setTab(value);
    window.history.replaceState(null, "", `${window.location.pathname}${tabQuery(value)}`);
  };

  // a user can hold several roles in a tournament: the strongest one counts
  const userRole = useMemo(() => highestRole(roles, user?.id), [roles, user]);
  const canManage = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;
  const canReferee = canManage || userRole === TournamentRoleType.REFEREE;

  const myTeam = useMemo(
    () => (user ? (teams.find((team) => team.members.some((m) => m.user_id === user.id)) ?? null) : null),
    [user, teams],
  );

  if (isLoading) return <PageSkeleton />;

  if (!tournament && preview) {
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-20 space-y-4">
        <TournamentPreviewCard preview={preview}>
          {preview.registration_open && (
            <JoinTournament tournamentId={preview.tournament_id} tournamentName={preview.name} loginRedirect={`/t/${slug}`} />
          )}
        </TournamentPreviewCard>
      </main>
    );
  }

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center space-y-4">
        <ShieldAlert className="size-16 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Kein Zugriff</h1>
        <p className="text-muted-foreground max-w-md">
          {error.message || "Du hast keinen Zugriff auf dieses Turnier oder es existiert nicht."}
        </p>
        <Link href="/tournaments" className={buttonVariants()}>
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12">
        <LoadError error={error} fallback="Das Turnier konnte nicht geladen werden." onRetry={retry} />
      </div>
    );
  }

  // the stations only matter while it runs; a tab that is not there (stations before the start or after the end,
  // settings without the role) shows the overview
  const hasStations = !!bracket && !tournament.finished_at;
  const shownTab: TournamentTab =
    (tab === "stations" && !hasStations) || (tab === "manage" && !canManage) ? "overview" : tab;
  // results only after the start and only for a match with both teams
  const openResult =
    canReferee && tournament.started_at
      ? (match: Match) => {
          if (match.team_a_id && match.team_b_id) setSelectedMatchId(match.id);
        }
      : undefined;
  const selectedMatch = bracket?.matches.find((match) => match.id === selectedMatchId);
  const matchTeamA = selectedMatch?.team_a_id ? teamsMap[selectedMatch.team_a_id] : undefined;
  const matchTeamB = selectedMatch?.team_b_id ? teamsMap[selectedMatch.team_b_id] : undefined;

  return (
    <GameProvider game={tournament.game}>
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <TournamentHeader tournament={tournament} teamCount={teams.length} />

      {live.status === "fallback" && (
        <output className="block text-sm text-muted-foreground">
          Keine Live-Verbindung. Die Seite prüft alle 30 Sekunden, ob sich etwas geändert hat.
        </output>
      )}

      {/* what concerns me right now, in every phase at the same place and on every tab */}
      <ParticipantStatus
        tournament={tournament}
        team={myTeam}
        bracket={bracket}
        teamsMap={teamsMap}
        canManage={canManage}
        slug={slug}
        onLeave={() => myTeam && actions.leaveTournament(myTeam)}
        compact={shownTab !== "overview"}
      />

      <Tabs value={shownTab} onValueChange={changeTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex-1">Übersicht</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1">Spielplan</TabsTrigger>
          {hasStations && <TabsTrigger value="stations" className="flex-1">{GAMES[tournament.game].station.plural}</TabsTrigger>}
          <TabsTrigger value="participants" className="flex-1">Teilnehmer</TabsTrigger>
        </TabsList>
        {canManage && (
          <Button
            variant="outline"
            className={cn("mt-2 h-11 w-full", tab === "manage" && "border-primary bg-primary/10 text-primary")}
            onClick={() => changeTab("manage")}
            aria-pressed={tab === "manage"}
          >
            <ShieldAlert aria-hidden="true" />
            Turnier verwalten
          </Button>
        )}

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* the end of the tournament: the winner first */}
          {tournament.finished_at && bracket && <PodiumCard bracket={bracket} teamsMap={teamsMap} />}
          {canManage && (
            <TournamentControlCard
              tournament={tournament}
              teams={teams}
              isStarting={actions.isStarting}
              onSetOpen={actions.setOpen}
              onStart={actions.startTournament}
            />
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Turnier-Ablauf</CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentTimeline tournament={tournament} />
            </CardContent>
          </Card>

          {tournament.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown className="text-muted-foreground">{tournament.description}</Markdown>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-6">
          {bracket ? (
            <Schedule bracket={bracket} teamsMap={teamsMap} highlightTeamId={myTeam?.id} onMatchClick={openResult} />
          ) : (
            <EmptyNote
              icon={Trophy}
              title="Der Spielplan wird beim Start ausgelost"
              description="Sobald das Turnier gestartet ist, findest du hier den Turnierbaum."
            />
          )}
        </TabsContent>

        {hasStations && bracket && (
          <TabsContent value="stations" className="mt-6">
            <StationsBoard
              tournamentId={tournament.id}
              bracket={bracket}
              stations={stations}
              teamsMap={teamsMap}
              highlightTeamId={myTeam?.id}
              onResult={openResult}
            />
          </TabsContent>
        )}

        <TabsContent value="participants" className="mt-6">
          <TournamentTeamsTab
            tournament={tournament}
            teams={teams}
            myTeamId={myTeam?.id}
            canManage={canManage}
            onCheckin={actions.setCheckedIn}
            onRemove={actions.removeTeam}
          />
        </TabsContent>

        {canManage && (
          <TabsContent value="manage" className="mt-6">
            <TournamentSettings tournament={tournament} roles={roles} userRole={userRole} />
          </TabsContent>
        )}
      </Tabs>

      {selectedMatch && matchTeamA && matchTeamB && (
        <MatchResultDialog
          tournamentId={tournament.id}
          game={tournament.game}
          match={selectedMatch}
          teamA={{ id: matchTeamA.id, name: matchTeamA.name }}
          teamB={{ id: matchTeamB.id, name: matchTeamB.name }}
          open
          onOpenChange={(open) => !open && setSelectedMatchId(null)}
        />
      )}
    </div>
    </GameProvider>
  );
}
