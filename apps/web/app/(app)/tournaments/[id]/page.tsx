"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/components/user-provider";
import type { Tournament, Bracket, Team, TournamentUserRole, Match, TournamentTeam } from "@/types";
import { TournamentRoleType, ResultType, TournamentVisibility } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BracketView } from "@/components/bracket-view";
import { MatchResultDialog } from "@/components/match-result-dialog";
import { TournamentSettings } from "@/components/tournament-settings";
import { MapPin, Calendar, Users, Trophy, Trash2, Play, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const formatStatus = (status: string) => {
  switch (status) {
    case "SETUP": return "In Vorbereitung";
    case "CHECKIN": return "Check-in offen";
    case "ANMELDUNG_GESCHLOSSEN": return "Anmeldung geschlossen";
    case "BRACKET_READY": return "Spielplan erstellt";
    case "ACTIVE": return "Läuft";
    case "COMPLETED": return "Abgeschlossen";
    default: return status;
  }
};

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

  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false);
  const [isStartingTournament, setIsStartingTournament] = useState(false);

  
  const [tournamentWinnerTeamId, setTournamentWinnerTeamId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [tData, rolesData, myTeamsData, tTeamsData] = await Promise.all([
        api.tournaments.get(tournamentId, inviteToken),
        api.roles.list(tournamentId),
        api.teams.list(), // currently list returns user teams
        api.tournaments.getTeams(tournamentId)
      ]);
      setTournament(tData);
      setRoles(rolesData);
      setMyTeams(myTeamsData);
      setTournamentTeams(tTeamsData);

      try {
        const bData = await api.tournaments.getBracket(tournamentId);
        if (bData && bData.matches.length > 0) {
          setBracket(bData);
          
          // U25: Determine tournament winner if finals are played
          const finalsMatch = bData.matches.find(m => m.round === bData.total_rounds);
          if (finalsMatch) {
            try {
              const results = await api.results.list(finalsMatch.id);
              const latestWin = [...results].reverse().find(r => r.type !== ResultType.DELETED);
              if (latestWin && latestWin.winner_team_id) {
                setTournamentWinnerTeamId(latestWin.winner_team_id);
              }
            } catch {
              // Ignore if we can't fetch finals result
            }
          }
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
    loadData();
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

  // Deriving status based on dates and bracket
  let status = "SETUP";
  let timelineStep = 1;
  
  let isRegistrationOpen = true;

  if (bracket && tournament?.started_at) {
    status = "ACTIVE";
    timelineStep = tournament.checkin_start_time ? 4 : 3;
    isRegistrationOpen = false;
  } else if (bracket) {
    status = "BRACKET_READY";
    timelineStep = tournament?.checkin_start_time ? 3 : 2;
    isRegistrationOpen = false;
  } else if (tournament) {
    const now = new Date();
    
    if (tournament.registration_end_time && now >= new Date(tournament.registration_end_time)) {
      isRegistrationOpen = false;
    }

    if (tournament.checkin_start_time && now >= new Date(tournament.checkin_start_time)) {
      status = "CHECKIN";
      timelineStep = 2;
    } else if (!isRegistrationOpen) {
      status = "ANMELDUNG_GESCHLOSSEN";
      timelineStep = 1;
    }
  }

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

  const handleGenerateBracket = () => {
    setConfirmState({
      title: "Möchtest du den Spielplan jetzt generieren?",
      description: "Achtung: Teams, die noch nicht eingecheckt sind, können nicht mehr teilnehmen. Dieser Schritt kann nicht rückgängig gemacht werden.",
      action: async () => {
        setIsGeneratingBracket(true);
        try {
          await api.tournaments.generateBracket(tournamentId);
          await loadData();
          toast.success("Spielplan generiert");
        } catch (err: unknown) {
          toast.error("Fehler beim Generieren des Spielplans");
        } finally {
          setIsGeneratingBracket(false);
        }
      }
    });
  };

  const handleStartTournament = () => {
    setConfirmState({
      title: "Möchtest du das Turnier jetzt offiziell starten?",
      description: "Sobald das Turnier gestartet ist, können Ergebnisse für Matches eingetragen werden.",
      action: async () => {
        setIsStartingTournament(true);
        try {
          await api.tournaments.startTournament(tournamentId);
          await loadData();
          toast.success("Turnier gestartet");
        } catch (err: unknown) {
          toast.error("Fehler beim offiziellen Turnierstart");
        } finally {
          setIsStartingTournament(false);
        }
      }
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
              <Badge variant={status === "SETUP" ? "secondary" : "default"}>{formatStatus(status)}</Badge>
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
          
          {isRegistrationOpen && !myTournamentTeam && (
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

          {!bracket && myTournamentTeam && (
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
          {canAdmin && (
            <Card className="border-primary/50 shadow-sm bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Turnier-Leitstand
                </CardTitle>
                <CardDescription>
                  Führe das Turnier durch die nächsten Phasen.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                {!bracket ? (
                  <Button 
                    onClick={handleGenerateBracket} 
                    disabled={tournamentTeams.length < 2}
                    className="w-full sm:w-auto"
                  >
                    Spielplan generieren
                  </Button>
                ) : !tournament.started_at ? (
                  <Button 
                    onClick={handleStartTournament} 
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  >
                    Turnier offiziell starten
                  </Button>
                ) : (
                  <div className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                    Turnier läuft! Ergebnisse können im Spielplan eingetragen werden.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Turnier-Ablauf</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const fmt = (d: string) => new Date(d).toLocaleString("de-DE", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit"
                });

                const now = new Date();

                // Build steps with phase start/end for progress calculation
                const steps = [
                  {
                    key: "registration",
                    icon: "📋",
                    label: "Anmeldung",
                    desc: tournament.registration_end_time
                      ? `Bis ${fmt(tournament.registration_end_time)}`
                      : "Offen bis Turnierbeginn",
                    step: 1,
                    phaseEnd: tournament.checkin_start_time
                      ? new Date(tournament.checkin_start_time)
                      : tournament.start_time
                        ? new Date(tournament.start_time)
                        : null,
                  },
                  ...(tournament.checkin_start_time ? [{
                    key: "checkin",
                    icon: "✅",
                    label: "Check-in",
                    desc: `Ab ${fmt(tournament.checkin_start_time)}`,
                    step: 2,
                    phaseEnd: tournament.start_time ? new Date(tournament.start_time) : null,
                  }] : []),
                  {
                    key: "active",
                    icon: "🏓",
                    label: "Spielphase",
                    desc: tournament.start_time
                      ? `Ab ${fmt(tournament.start_time)}`
                      : "Nach dem Check-in",
                    step: tournament.checkin_start_time ? 3 : 2,
                    phaseEnd: null,
                  },
                  {
                    key: "done",
                    icon: "🏆",
                    label: "Abgeschlossen",
                    desc: "Sieger werden gekrönt",
                    step: tournament.checkin_start_time ? 4 : 3,
                    phaseEnd: null,
                  },
                ];

                // Calculate progress fill % for the connector line leaving step i
                // The line *after* step i goes from step i's phaseEnd to step i+1's start
                // We use: if step i is done → 100%, if step i is active → time-based %, else → 0%
                const getLineProgress = (i: number): number => {
                  const s = steps[i];
                  const nextS = steps[i + 1];
                  if (!nextS) return 0;
                  const isDone = timelineStep > s.step;
                  const isActive = timelineStep === s.step;
                  if (isDone) return 100;
                  if (isActive && s.phaseEnd) {
                    // Find phase start: previous step's phaseEnd or tournament start
                    const prevPhaseEnd = i > 0 ? steps[i - 1].phaseEnd : null;
                    const phaseStart = prevPhaseEnd ?? (tournament.registration_end_time ? new Date(tournament.registration_end_time) : null);
                    if (phaseStart) {
                      const total = s.phaseEnd.getTime() - phaseStart.getTime();
                      if (total <= 0) return 100; // Overlapping or instantaneous phases
                      const elapsed = now.getTime() - phaseStart.getTime();
                      return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
                    }
                    return 50; // fallback mid-progress
                  }
                  return 0;
                };

                return (
                  <div className="flex flex-col sm:flex-row w-full mt-2">
                    {steps.map((s, i) => {
                      let done = timelineStep > s.step;
                      let active = timelineStep === s.step;

                      // UX rule: Anmeldung is visually 'done' ONLY when its deadline is reached
                      // If no deadline is defined, it uses the default timelineStep logic
                      if (s.key === "registration" && tournament.registration_end_time) {
                        const isClosed = now >= new Date(tournament.registration_end_time);
                        done = isClosed;
                        active = !isClosed;
                      }

                      const isLast = i === steps.length - 1;
                      const lineProgress = getLineProgress(i); // 0–100

                      return (
                        <div key={s.key} className="flex sm:flex-col flex-row flex-1 items-start sm:items-stretch min-w-0">
                          <div className="flex sm:flex-col flex-row items-center gap-3 sm:gap-1 flex-1 min-w-0 w-full">

                            {/* ── Desktop: horizontal connector + circle ── */}
                            <div className="hidden sm:flex items-center w-full mb-1">
                              {/* Left progress bar (second half of previous segment) */}
                              {i > 0 ? (
                                <div className="flex-1 h-1 bg-border overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-700 ease-out"
                                    style={{ width: `${Math.max(0, (getLineProgress(i - 1) - 50) * 2)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 opacity-0 h-1" />
                              )}

                              {/* Circle */}
                              <div className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0 text-base transition-all duration-300
                                ${done
                                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                                  : active
                                    ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/20 shadow-md"
                                    : "bg-muted border-border text-muted-foreground"
                                }`}>
                                {done ? "✓" : s.icon}
                              </div>

                              {/* Right progress bar (first half of current segment) */}
                              {!isLast ? (
                                <div className="flex-1 h-1 bg-border overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all duration-700 ease-out"
                                    style={{ width: `${Math.min(100, lineProgress * 2)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 opacity-0 h-1" />
                              )}
                            </div>

                            {/* ── Mobile: vertical connector + circle ── */}
                            <div className="flex sm:hidden flex-col items-center self-stretch">
                              {i > 0 ? (
                                <div className="w-1 flex-1 min-h-[1.5rem] bg-border overflow-hidden">
                                  <div
                                    className="w-full bg-primary transition-all duration-700 ease-out"
                                    style={{ height: `${Math.max(0, (getLineProgress(i - 1) - 50) * 2)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 min-h-[1rem] opacity-0" />
                              )}
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 text-sm transition-all duration-300
                                ${done
                                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                                  : active
                                    ? "bg-primary/10 border-primary text-primary ring-4 ring-primary/20 shadow-md"
                                    : "bg-muted border-border text-muted-foreground"
                                }`}>
                                {done ? "✓" : s.icon}
                              </div>
                              {!isLast ? (
                                <div className="w-1 flex-1 min-h-[1.5rem] bg-border overflow-hidden">
                                  <div
                                    className="w-full bg-primary transition-all duration-700 ease-out"
                                    style={{ height: `${Math.min(100, lineProgress * 2)}%` }}
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 min-h-[1rem] opacity-0" />
                              )}
                            </div>

                            {/* Text */}
                            <div className="text-center sm:text-center text-left pb-4 sm:pb-0 px-1 sm:px-2 flex-1 sm:flex-none">
                              <p className={`text-sm font-semibold leading-tight ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.label}
                                {active && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle animate-pulse" />}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {tournament.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {tournament.description}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {myTournamentTeam && bracket && (
            <Card>
              <CardHeader>
                <CardTitle>Was betrifft mich gerade?</CardTitle>
                <CardDescription>Dein nächstes oder aktuelles Spiel</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const myMatches = bracket.matches.filter(m => m.team_a_id === myTournamentTeam.id || m.team_b_id === myTournamentTeam.id);
                  const currentMatch = myMatches.sort((a,b) => b.round - a.round)[0];
                  if (!currentMatch) return <p className="text-muted-foreground">Du hast aktuell kein aktives Spiel.</p>;
                  
                  const opponentId = currentMatch.team_a_id === myTournamentTeam.id ? currentMatch.team_b_id : currentMatch.team_a_id;
                  const opponent = opponentId ? teamsMap[opponentId] : null;
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <p className="font-medium text-sm text-primary">Runde {currentMatch.round}</p>
                      <div className="p-4 rounded-lg border bg-card flex items-center justify-between shadow-sm">
                        <span className="font-bold truncate text-right flex-1">{myTournamentTeam.name}</span>
                        <span className="text-muted-foreground mx-4 text-xs font-semibold">VS</span>
                        <span className={`truncate text-left flex-1 ${opponent ? "font-bold" : "italic text-muted-foreground"}`}>{opponent ? opponent.name : "TBD"}</span>
                      </div>
                      {currentMatch.table_number && (
                        <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                          <Trophy className="h-4 w-4" /> Tisch {currentMatch.table_number}
                        </p>
                      )}
                    </div>
                  );
                })()}
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
                  <p className="font-medium text-lg text-foreground">Der Spielplan wurde noch nicht erstellt.</p>
                  <p className="mt-2 text-sm">Sobald der Admin das Turnier startet, findest du hier den Turnierbaum.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <BracketView 
                    bracket={bracket} 
                    teamsMap={teamsMap} 
                    tournamentWinnerTeamId={tournamentWinnerTeamId}
                    onMatchClick={canReferee ? handleMatchClick : undefined} 
                  />
                  
                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">Alle Spiele</h3>
                    <div className="space-y-2">
                      {[...bracket.matches].sort((a,b) => a.round - b.round || a.position - b.position).map(m => {
                        const tA = m.team_a_id ? teamsMap[m.team_a_id] : null;
                        const tB = m.team_b_id ? teamsMap[m.team_b_id] : null;
                        return (
                          <div key={m.id} className="p-3 border rounded-lg flex items-center justify-between text-sm">
                            <div className="flex-1 text-right truncate font-medium">{tA ? tA.name : "TBD"}</div>
                            <div className="px-4 text-[10px] uppercase font-bold text-muted-foreground">Runde {m.round}</div>
                            <div className="flex-1 text-left truncate font-medium">{tB ? tB.name : "TBD"}</div>
                          </div>
                        );
                      })}
                    </div>
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
            <CardContent>
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
                      
                        {/* Design Decision (L9): Check-in buttons are intentionally hidden after bracket generation (BRACKET_READY/ACTIVE) because changing check-in status post-bracket would require regenerating the bracket, which disrupts the tournament flow. */}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {canManage && (status === "SETUP" || status === "CHECKIN" || status === "ANMELDUNG_GESCHLOSSEN") ? (
                            <>
                              {tournament?.checkin_start_time && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-8 px-2 text-xs ${team.is_checked_in ? 'text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 dark:bg-green-950/30' : 'text-muted-foreground'}`}
                                  onClick={() => handleCheckin(team.id, team.name, !team.is_checked_in)}
                                  title={team.is_checked_in ? "Check-out" : "Check-in"}
                                >
                                  {team.is_checked_in ? <><Check className="h-4 w-4 mr-1" /> Eingecheckt</> : "Check-in"}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleRemoveTeam(team.id, team.name)}
                                title="Team entfernen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            team.is_checked_in && (
                              <div className="flex items-center h-8 px-2 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950/30 rounded-md">
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
              status={status}
              roles={roles}
              userRole={userRole}
              teamCount={tournamentTeams.length}
              onGenerateBracket={handleGenerateBracket}
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
