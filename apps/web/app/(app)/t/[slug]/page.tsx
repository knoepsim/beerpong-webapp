"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/components/user-provider";
import type { Tournament, Bracket, Team, TournamentUserRole, Match, TournamentTeam, TournamentPreview } from "@/types";
import { JoinPolicy, TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BracketView } from "@/components/bracket-view";
import { MatchList } from "@/components/match-list";
import { MyMatches } from "@/components/my-matches";
import { MatchResultDialog } from "@/components/match-result-dialog";
import { TournamentSettings } from "@/components/tournament-settings";
import { TournamentTimeline } from "@/components/tournament-timeline";
import { CheckinSummary } from "@/components/checkin-summary";
import { TournamentTeamList } from "@/components/tournament-team-list";
import { phaseLabel, planStart } from "@/lib/tournament-phase";
import { formatWhen } from "@/lib/format-when";
import { useTournamentLive, type LiveScope } from "@/hooks/use-tournament-live";
import { PreparationControls } from "@/components/preparation-controls";
import { JoinTournament } from "@/components/join-tournament";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { MapPin, Calendar, Users, Trophy, Play, Share2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import { Check, X, RefreshCw, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useCurrentUser();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  // the address is /t/{slug}; everything else is requested by the id behind it
  const tournamentId = tournament?.id ?? "";
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [roles, setRoles] = useState<TournamentUserRole[]>([]);

  // a stranger who may join sees this instead of the tournament
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [tournamentTeams, setTournamentTeams] = useState<TournamentTeam[]>([]); // Teams in this tournament
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{title: string, description?: string, action: () => Promise<void>} | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const [isStartingTournament, setIsStartingTournament] = useState(false);
  const [tab, setTab] = useState("overview");

  

  const loadData = async () => {
    try {
      const tData = await api.tournaments.getBySlug(slug);
      const [rolesData, tTeamsData] = await Promise.all([
        api.roles.list(tData.id),
        api.tournaments.getTeams(tData.id),
      ]);
      setTournament(tData);
      setPreview(null);
      setRoles(rolesData);
      setTournamentTeams(tTeamsData);

      try {
        const bData = await api.tournaments.getBracket(tData.id);
        if (bData && bData.matches.length > 0) {
          setBracket(bData);
        }
      } catch {
        // Bracket not generated yet
        setBracket(null);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // a tournament that is not visible to me may still be open to join: show what a stranger may see
        if (err.status === 404 || err.status === 403) {
          setPreview(await api.tournaments.getPreview(slug).catch(() => null));
        }
        setErrorCode(err.status);
        setError(err.message);
      } else {
        const message = err instanceof Error ? err.message : "Fehler beim Laden des Turniers";
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [slug]);

  // Only the parts the server says have changed are loaded again; a failed refresh keeps showing the last state.
  const refresh = async (scopes: LiveScope[]) => {
    if (!tournament) return;
    const id = tournament.id;
    const load: Record<LiveScope, () => Promise<void>> = {
      tournament: async () => setTournament(await api.tournaments.getBySlug(slug)),
      teams: async () => setTournamentTeams(await api.tournaments.getTeams(id)),
      bracket: async () => {
        const data = await api.tournaments.getBracket(id);
        setBracket(data.matches.length > 0 ? data : null);
      },
      roles: async () => setRoles(await api.roles.list(id)),
    };
    await Promise.allSettled(scopes.map((scope) => load[scope]()));
  };
  const live = useTournamentLive({ tournamentId: tournament?.id, revision: tournament?.revision, onChange: refresh });

  const teamsMap = useMemo(() => {
    const map: Record<string, Team> = {};
    for (const t of tournamentTeams) map[t.id] = t;
    return map;
  }, [tournamentTeams]);

  const userRole = useMemo(() => {
    if (!user) return null;
    const roleObj = roles.find((r) => r.user_id === user.id);
    return roleObj ? roleObj.role : null;
  }, [roles, user]);

  const startPlan = tournament ? planStart(tournament, tournamentTeams) : null;

  const canAdmin = userRole === TournamentRoleType.ADMIN;
  const canManage = canAdmin || userRole === TournamentRoleType.MANAGER;
  const canReferee = canManage || userRole === TournamentRoleType.REFEREE;

  const myTournamentTeam = useMemo(() => {
    if (!user || !tournamentTeams.length) return null;
    return tournamentTeams.find(team => team.members.some(m => m.user_id === user.id)) || null;
  }, [user, tournamentTeams]);

  const handleLeave = () => {
    setConfirmState({
      title: "Möchtest du dein Team wirklich aus dem Turnier abmelden?",
      action: async () => {
        try {
          await api.tournaments.leave(tournamentId);
          await loadData();
          toast.success("Erfolgreich abgemeldet");
        } catch (err: unknown) {
          toast.error("Fehler beim Abmelden");
        }
      }
    });
  };

  const handleRemoveTeam = (teamId: string, teamName: string) => {
    setConfirmState({
      title: `Möchtest du das Team "${teamName}" wirklich aus dem Turnier entfernen?`,
      action: async () => {
        try {
          await api.tournaments.removeTeam(tournamentId, teamId);
          await loadData();
          toast.success("Team entfernt");
        } catch (err: unknown) {
          toast.error("Fehler beim Entfernen des Teams");
        }
      }
    });
  };

  const handleCheckin = async (teamId: string, teamName: string, isCheckedIn: boolean) => {
    // Optimistic UI Update
    setTournamentTeams(prev => prev.map(t => t.id === teamId ? { ...t, is_checked_in: isCheckedIn } : t));
    try {
      await api.tournaments.checkin(tournamentId, teamId, isCheckedIn);
    } catch (err: unknown) {
      toast.error(`Fehler beim ${isCheckedIn ? 'Check-in' : 'Check-out'} des Teams`);
      // Revert on error
      setTournamentTeams(prev => prev.map(t => t.id === teamId ? { ...t, is_checked_in: !isCheckedIn } : t));
    }
  };

  const handleSetOpen = async (kind: "registration" | "checkin", open: boolean) => {
    try {
      if (kind === "registration") await api.tournaments.setRegistrationOpen(tournamentId, open);
      else await api.tournaments.setCheckinOpen(tournamentId, open);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Das hat nicht geklappt. Versuche es noch einmal.");
    }
  };

  const handleStartTournament = () => {
    if (!tournament) return;
    const plan = planStart(tournament, tournamentTeams);
    if (!plan.canStart) {
      toast.error(plan.description);
      return;
    }
    setConfirmState({
      title: "Turnier jetzt starten?",
      description: tournament.registration_open ? `${plan.description} Die Anmeldung wird geschlossen.` : plan.description,
      action: async () => {
        setIsStartingTournament(true);
        try {
          const result = await api.tournaments.startTournament(tournamentId);
          await loadData();
          toast.success(
            result.removed_team_ids.length > 0
              ? `Turnier gestartet. ${result.removed_team_ids.length} Team(s) ohne Check-in entfernt.`
              : "Turnier gestartet",
          );
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Fehler beim Turnierstart");
        } finally {
          setIsStartingTournament(false);
        }
      },
    });
  };

  const handleMatchClick = (match: Match) => {
    if (!canReferee) return;
    if (!tournament?.started_at) {
      toast.error("Ergebnisse können erst eingetragen werden, wenn das Turnier offiziell gestartet wurde.");
      return;
    }
    // Only allow if both teams are set
    if (!match.team_a_id || !match.team_b_id) return;
    setSelectedMatch(match);
  };

  const handleShare = async () => {
    // the plain address, without whatever is in the address bar (an invitation, a tab)
    const url = `${window.location.origin}/t/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: tournament?.name || "Beerpong Turnier",
          url: url,
        });
      } catch (err) {
        // user aborted or not supported
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Turnier-Link kopiert!");
    }
  };

  if (isLoading) {
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
  if (!tournament && preview) {
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-20 space-y-4">
        <TournamentPreviewCard preview={preview}>
          {preview.registration_open && (
            <JoinTournament
              tournamentId={preview.tournament_id}
              tournamentName={preview.name}
              loginRedirect={`/t/${slug}`}
              onJoined={loadData}
            />
          )}
        </TournamentPreviewCard>
      </main>
    );
  }
  if (errorCode === 403 || errorCode === 404) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Kein Zugriff</h2>
        <p className="text-muted-foreground max-w-md">
          {error || "Du hast keinen Zugriff auf dieses Turnier oder es existiert nicht."}
        </p>
        <Button variant="default" onClick={() => router.push("/tournaments")}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="text-center text-destructive">{error || "Turnier nicht gefunden"}</div>
        <Button variant="outline" onClick={() => loadData()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  const matchTeamA = selectedMatch?.team_a_id ? teamsMap[selectedMatch.team_a_id] : undefined;
  const matchTeamB = selectedMatch?.team_b_id ? teamsMap[selectedMatch.team_b_id] : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
              {tournament.join_policy === JoinPolicy.OPEN && (
                <Button variant="ghost" size="icon" onClick={handleShare} className="h-8 w-8" title="Turnier teilen">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant={tournament.phase === "running" ? "default" : "secondary"}>
                {phaseLabel(tournament.phase)}
              </Badge>
              {tournament.start_time && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> 
                  {new Date(tournament.start_time).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })} Uhr
                </span>
              )}
              {tournament.location && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {tournament.location}</span>
              )}
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {tournamentTeams.length} {tournamentTeams.length === 1 ? 'Team' : 'Teams'}</span>
            </div>
          </div>
          
          {tournament.registration_open && !myTournamentTeam && !canManage && (
            tournament.join_policy === JoinPolicy.OPEN ? (
              <JoinTournament
                tournamentId={tournament.id}
                tournamentName={tournament.name}
                loginRedirect={`/t/${slug}`}
                onJoined={loadData}
              />
            ) : (
              <p className="text-sm text-muted-foreground md:max-w-xs">
                Beitreten kannst du nur mit einem Einladungslink vom Veranstalter.
              </p>
            )
          )}

          {!tournament.started_at && myTournamentTeam && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Angemeldet mit <strong className="text-foreground">{myTournamentTeam.name}</strong>
              </span>
              <Button variant="outline" onClick={handleLeave}>
                Team abmelden
              </Button>
            </div>
          )}
        </div>
      </div>

      {live.status === "fallback" && (
        <output className="block text-sm text-muted-foreground">
          Keine Live-Verbindung. Die Seite prüft alle 30 Sekunden, ob sich etwas geändert hat.
        </output>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex-1">Übersicht</TabsTrigger>
          <TabsTrigger value="bracket" className="flex-1">Spielplan</TabsTrigger>
          <TabsTrigger value="teams" className="flex-1">Teilnehmer</TabsTrigger>
        </TabsList>
        {canManage && (
          <Button
            variant="outline"
            className={cn("mt-2 h-11 w-full", tab === "admin" && "border-primary bg-primary/10 text-primary")}
            onClick={() => setTab("admin")}
            aria-pressed={tab === "admin"}
          >
            <ShieldAlert aria-hidden="true" />
            Turnier verwalten
          </Button>
        )}

        <TabsContent value="overview" className="mt-6 space-y-6">
          {canManage && (
            <Card className="border-primary/50 shadow-sm bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Turnier-Leitstand
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tournament.started_at ? (
                  <div className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" aria-hidden="true" />
                    Ergebnisse können im Spielplan eingetragen werden.
                  </div>
                ) : (
                  <>
                    <PreparationControls
                      tournament={tournament}
                      onRegistration={(open) => handleSetOpen("registration", open)}
                      onCheckin={(open) => handleSetOpen("checkin", open)}
                    />
                    {tournament.checkin_open && <CheckinSummary teams={tournamentTeams} />}
                    <Button
                      onClick={handleStartTournament}
                      disabled={isStartingTournament || !startPlan?.canStart}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      Turnier starten
                    </Button>
                    {!startPlan?.canStart && <p className="text-sm text-muted-foreground">{startPlan?.description}</p>}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {myTournamentTeam && !tournament.started_at && tournament.checkin_enabled && (
            <Card className={myTournamentTeam.is_checked_in ? "border-green-600/40 bg-green-50 dark:bg-green-950/20" : "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"}>
              <CardContent className="py-4 text-sm">
                {myTournamentTeam.is_checked_in ? (
                  <p className="font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                    Dein Team ist eingecheckt.
                  </p>
                ) : (
                  <p>
                    <span className="font-medium">Dein Team ist noch nicht eingecheckt.</span>{" "}
                    Melde dich vor Ort beim Orga-Team, sonst wirst du beim Start aus dem Turnier entfernt.
                  </p>
                )}
              </CardContent>
            </Card>
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

          {myTournamentTeam && bracket && (
            <Card>
              <CardHeader>
                <CardTitle>Was betrifft mich gerade?</CardTitle>
                <CardDescription>Deine anstehenden Spiele</CardDescription>
              </CardHeader>
              <CardContent>
                <MyMatches
                  bracket={bracket}
                  teamsMap={teamsMap}
                  teamId={myTournamentTeam.id}
                  onMatchClick={canReferee ? handleMatchClick : undefined}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bracket" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Turnierbaum</CardTitle>
              {canReferee && <CardDescription>Klicke auf ein Match, um das Ergebnis einzutragen.</CardDescription>}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="space-y-4 w-full max-w-3xl">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </div>
              ) : !bracket ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border rounded-lg bg-card/50">
                  <Trophy className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium text-lg text-foreground">Der Spielplan wird beim Start ausgelost.</p>
                  <p className="mt-2 text-sm">Sobald das Turnier gestartet ist, findest du hier den Turnierbaum.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <BracketView
                    bracket={bracket}
                    teamsMap={teamsMap}
                    onMatchClick={canReferee ? handleMatchClick : undefined}
                    highlightTeamId={myTournamentTeam?.id}
                  />
                  
                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Alle Spiele</h3>
                    <MatchList
                      bracket={bracket}
                      teamsMap={teamsMap}
                      highlightTeamId={myTournamentTeam?.id}
                      onMatchClick={canReferee ? handleMatchClick : undefined}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="mt-6 space-y-4">
          {tournament.checkin_enabled && !tournament.started_at && tournamentTeams.length > 0 && (
            <CheckinSummary teams={tournamentTeams} />
          )}
          {tournament.checkin_enabled &&
            !tournament.started_at &&
            !tournament.checkin_open &&
            tournament.checkin_auto_open &&
            tournament.checkin_start_time && (
              <p className="text-sm text-muted-foreground">
                Der Check-in beginnt {formatWhen(tournament.checkin_start_time)}.
              </p>
            )}
          {tournamentTeams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Noch keine Teams angemeldet.</p>
          ) : (
            <TournamentTeamList
              teams={tournamentTeams}
              myTeamId={myTournamentTeam?.id}
              showCheckin={tournament.checkin_enabled && !tournament.started_at}
              checkinOpen={tournament.checkin_open}
              canManage={canManage && !tournament.started_at}
              onCheckin={(team, checkedIn) => handleCheckin(team.id, team.name, checkedIn)}
              onRemove={(team) => handleRemoveTeam(team.id, team.name)}
            />
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="admin" className="mt-6">
            <TournamentSettings 
              tournament={tournament}
              roles={roles}
              userRole={userRole}
              onReload={loadData}
            />
          </TabsContent>
        )}
      </Tabs>

      {selectedMatch && matchTeamA && matchTeamB && (
        <MatchResultDialog
          match={selectedMatch}
          teamA={{ id: matchTeamA.id, name: matchTeamA.name }}
          teamB={{ id: matchTeamB.id, name: matchTeamB.name }}
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          onSuccess={() => loadData()}
        />
      )}

      <AlertDialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={isConfirmLoading} onClick={async (e) => {
              e.preventDefault();
              setIsConfirmLoading(true);
              try {
                await confirmState?.action();
                setConfirmState(null);
              } finally {
                setIsConfirmLoading(false);
              }
            }}>
              {isConfirmLoading ? "Lädt..." : "Bestätigen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
