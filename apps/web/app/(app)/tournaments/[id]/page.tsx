"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/components/user-provider";
import type { Tournament, Bracket, Team, TournamentUserRole, Match, TournamentTeam } from "@/types";
import { TournamentRoleType, TournamentVisibility } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { checkinOpensAt, phaseLabel, planStart } from "@/lib/tournament-phase";
import { MapPin, Calendar, Users, Trophy, Trash2, Play, Share2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { user } = useCurrentUser();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [roles, setRoles] = useState<TournamentUserRole[]>([]);

  const [myTeams, setMyTeams] = useState<Team[]>([]); // for joining
  const [tournamentTeams, setTournamentTeams] = useState<TournamentTeam[]>([]); // Teams in this tournament
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  // Dialog states
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{title: string, description?: string, action: () => Promise<void>} | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const [isStartingTournament, setIsStartingTournament] = useState(false);

  

  const loadData = async () => {
    try {
      const [tData, rolesData, myTeamsData, tTeamsData] = await Promise.all([
        api.tournaments.get(tournamentId, inviteToken),
        api.roles.list(tournamentId, inviteToken),
        api.teams.list(), // currently list returns user teams
        api.tournaments.getTeams(tournamentId, inviteToken)
      ]);
      setTournament(tData);
      setRoles(rolesData);
      setMyTeams(myTeamsData);
      setTournamentTeams(tTeamsData);

      try {
        const bData = await api.tournaments.getBracket(tournamentId, inviteToken);
        if (bData && bData.matches.length > 0) {
          setBracket(bData);
        }
      } catch {
        // Bracket not generated yet
        setBracket(null);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
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
  }, [tournamentId]);

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

  const canAdmin = userRole === TournamentRoleType.ADMIN;
  const canManage = canAdmin || userRole === TournamentRoleType.MANAGER;
  const canReferee = canManage || userRole === TournamentRoleType.REFEREE;

  const myTournamentTeam = useMemo(() => {
    if (!user || !tournamentTeams.length) return null;
    return tournamentTeams.find(team => team.members.some(m => m.user_id === user.id)) || null;
  }, [user, tournamentTeams]);

  const handleJoin = async () => {
    if (!selectedTeamId) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      await api.tournaments.join(tournamentId, selectedTeamId, inviteToken);
      setJoinDialogOpen(false);
      await loadData();
      toast.success("Turnier erfolgreich beigetreten");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Beitreten";
      setJoinError(message);
    } finally {
      setIsJoining(false);
    }
  };

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

  const handleStartTournament = () => {
    if (!tournament) return;
    const plan = planStart(tournament, tournamentTeams);
    if (!plan.canStart) {
      toast.error(plan.description);
      return;
    }
    setConfirmState({
      title: "Turnier jetzt starten?",
      description: plan.description,
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
    const url = window.location.href;
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
        <Button variant="outline" onClick={loadData}>
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
              {(tournament?.visibility === TournamentVisibility.PUBLIC_LISTED || tournament?.visibility === TournamentVisibility.PUBLIC_UNLISTED) && (
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
          
          {tournament.registration_open && !myTournamentTeam && (
            <Dialog open={joinDialogOpen} onOpenChange={(open) => {
              setJoinDialogOpen(open);
              if (open) {
                setJoinError(null);
                if (myTeams.length === 1 && !selectedTeamId) {
                  setSelectedTeamId(myTeams[0].id);
                }
              }
            }}>
              <DialogTrigger className={buttonVariants()}>
                Mit Team beitreten
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Turnier beitreten</DialogTitle>
                  <DialogDescription>
                    Wähle ein Team, um an {tournament.name} teilzunehmen.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {myTeams.length === 0 ? (
                    <div className="text-center py-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Du bist in keinem Team. Gründe zuerst ein Team, um an Turnieren teilnehmen zu können.
                      </p>
                      <Button variant="outline" onClick={() => router.push("/teams")}>
                        Zu meinen Teams
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Dein Team</Label>
                        <Select value={selectedTeamId} onValueChange={(val) => setSelectedTeamId(val || "")}>
                          <SelectTrigger>
                            <span className={selectedTeamId ? "text-foreground" : "text-muted-foreground"}>
                              {selectedTeamId ? myTeams.find(t => t.id === selectedTeamId)?.name : "Team auswählen…"}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {myTeams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} {!t.is_complete && "(Unvollständig)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={handleJoin} 
                        disabled={!selectedTeamId || isJoining}
                      >
                        {isJoining ? "Beitreten…" : "Jetzt teilnehmen"}
                      </Button>
                      {joinError && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                          {joinError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex-1">Übersicht</TabsTrigger>
          <TabsTrigger value="bracket" className="flex-1">Spielplan</TabsTrigger>
          <TabsTrigger value="teams" className="flex-1">Teilnehmer</TabsTrigger>
          {canManage && <TabsTrigger value="admin" className="flex-1">
            <ShieldAlert className="h-3 w-3 mr-1.5" />
            Einstellungen
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {canManage && (
            <Card className="border-primary/50 shadow-sm bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Turnier-Leitstand
                </CardTitle>
                <CardDescription>
                  {tournament.started_at
                    ? "Das Turnier läuft."
                    : tournament.checkin_enabled
                      ? "Checke die Teams vor Ort ein und starte dann das Turnier."
                      : "Starte das Turnier, sobald alle Teams bereit sind."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tournament.started_at ? (
                  <div className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" aria-hidden="true" />
                    Ergebnisse können im Spielplan eingetragen werden.
                  </div>
                ) : (
                  <>
                    {tournament.checkin_enabled && <CheckinSummary teams={tournamentTeams} />}
                    <Button
                      onClick={handleStartTournament}
                      disabled={isStartingTournament || !planStart(tournament, tournamentTeams).canStart}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      Turnier starten
                    </Button>
                    {!planStart(tournament, tournamentTeams).canStart && (
                      <p className="text-sm text-muted-foreground">
                        {planStart(tournament, tournamentTeams).description}
                      </p>
                    )}
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

        <TabsContent value="teams" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Teilnehmer</CardTitle>
              <CardDescription>Teams, die an diesem Turnier teilnehmen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tournament.checkin_enabled && !tournament.started_at && tournamentTeams.length > 0 && (
                <CheckinSummary teams={tournamentTeams} />
              )}
              {tournament.checkin_enabled && !tournament.started_at && !tournament.checkin_open && checkinOpensAt(tournament) && (
                <p className="text-sm text-muted-foreground">
                  Der Check-in beginnt am{" "}
                  {new Date(checkinOpensAt(tournament)!).toLocaleString("de-DE", {
                    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}{" "}
                  Uhr.
                </p>
              )}
              {tournamentTeams.length === 0 ? (
                <p className="text-muted-foreground italic text-center py-8">
                  Noch keine Teams beigetreten.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {tournamentTeams.map((team) => {
                    const isMyTeam = team.id === myTournamentTeam?.id;
                    return (
                    <div 
                      key={team.id} 
                      className={`relative flex flex-col p-3 border rounded-lg gap-2 ${
                        isMyTeam ? "border-primary bg-primary/5" : "bg-muted/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-medium truncate">{team.name}</p>
                      </div>
                      {team.members.length > 0 ? (
                        <div className="text-sm text-muted-foreground flex gap-1.5 flex-wrap">
                          {team.members.map(m => (
                            <span key={m.user_id} className="bg-secondary/50 px-2 py-0.5 rounded-md text-xs">{m.name}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic text-xs">
                          Keine Spieler
                        </div>
                      )}
                      
                        <div className="absolute top-2 right-2 flex gap-1">
                          {canManage && !tournament.started_at ? (
                            <>
                              {tournament.checkin_enabled && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`h-9 px-3 text-xs ${team.is_checked_in ? "border-green-700 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-500 dark:bg-green-950/40 dark:text-green-200" : ""}`}
                                  onClick={() => handleCheckin(team.id, team.name, !team.is_checked_in)}
                                  disabled={!tournament.checkin_open}
                                  aria-pressed={team.is_checked_in}
                                  aria-label={`${team.name} ${team.is_checked_in ? "ist eingecheckt, Check-in zurücknehmen" : "einchecken"}`}
                                  title={
                                    tournament.checkin_open
                                      ? team.is_checked_in ? "Check-in zurücknehmen" : "Team einchecken"
                                      : "Der Check-in hat noch nicht begonnen"
                                  }
                                >
                                  {team.is_checked_in ? <><Check className="h-4 w-4 mr-1" /> Eingecheckt</> : "Einchecken"}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRemoveTeam(team.id, team.name)}
                                title="Team entfernen"
                                aria-label={`Team ${team.name} entfernen`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            team.is_checked_in && !tournament.started_at && (
                              <div className="flex items-center h-8 px-2 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-md">
                                <Check className="h-4 w-4 mr-1" /> Eingecheckt
                              </div>
                            )
                          )}
                        </div>
                      </div>
                  );
                })}
                </div>
              )}
            </CardContent>
          </Card>
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
          matchId={selectedMatch.id}
          nextMatchId={selectedMatch.next_match_id}
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
