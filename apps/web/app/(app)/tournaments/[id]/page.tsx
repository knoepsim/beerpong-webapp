"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/components/user-provider";
import type { Tournament, Bracket, Team, TournamentUserRole, Match } from "@/types";
import { TournamentRoleType } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BracketView } from "@/components/bracket-view";
import { MatchResultDialog } from "@/components/match-result-dialog";
import { TournamentSettings } from "@/components/tournament-settings";
import { MapPin, Calendar, Users, Trophy, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const router = useRouter();
  const { user } = useCurrentUser();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [roles, setRoles] = useState<TournamentUserRole[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]); // needed for bracket names
  const [myTeams, setMyTeams] = useState<Team[]>([]); // for joining
  const [tournamentTeams, setTournamentTeams] = useState<Team[]>([]); // Teams in this tournament
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const loadData = async () => {
    try {
      const [tData, teamsData, rolesData, myTeamsData, tTeamsData] = await Promise.all([
        api.tournaments.get(tournamentId),
        api.teams.list(), // using this to resolve all team names for now
        api.roles.list(tournamentId),
        api.teams.list(), // currently list returns user teams
        api.tournaments.getTeams(tournamentId)
      ]);
      setTournament(tData);
      setAllTeams(teamsData);
      setRoles(rolesData);
      setMyTeams(myTeamsData);
      setTournamentTeams(tTeamsData);

      try {
        const bData = await api.tournaments.getBracket(tournamentId);
        if (bData && bData.matches.length > 0) {
          setBracket(bData);
        }
      } catch {
        // Bracket not generated yet
        setBracket(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden des Turniers";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const teamsMap = useMemo(() => {
    const map: Record<string, Team> = {};
    for (const t of allTeams) map[t.id] = t;
    return map;
  }, [allTeams]);

  const userRole = useMemo(() => {
    if (!user) return null;
    const roleObj = roles.find((r) => r.user_id === user.id);
    return roleObj ? roleObj.role : null;
  }, [roles, user]);

  const canManage = userRole === TournamentRoleType.ADMIN || userRole === TournamentRoleType.MANAGER;
  const canReferee = canManage || userRole === TournamentRoleType.REFEREE;

  // Deriving status based on bracket
  const status = !bracket 
    ? "SETUP" 
    : bracket.matches.some(m => m.round === bracket.total_rounds && m.team_a_id && m.team_b_id /* check result */) 
      ? "LÄUFT" // Simplified for now
      : "LÄUFT";

  const myTournamentTeam = useMemo(() => {
    if (!user || !tournamentTeams.length) return null;
    return tournamentTeams.find(team => team.members.some(m => m.user_id === user.id)) || null;
  }, [user, tournamentTeams]);

  const handleJoin = async () => {
    if (!selectedTeamId) return;
    setIsJoining(true);
    try {
      await api.tournaments.join(tournamentId, selectedTeamId);
      setJoinDialogOpen(false);
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Beitreten";
      alert(message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm("Möchtest du dein Team wirklich aus dem Turnier abmelden?")) return;
    try {
      await api.tournaments.leave(tournamentId);
      await loadData();
    } catch (err: unknown) {
      alert("Fehler beim Abmelden");
    }
  };

  const handleRemoveTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Möchtest du das Team "${teamName}" wirklich aus dem Turnier entfernen?`)) return;
    try {
      await api.tournaments.removeTeam(tournamentId, teamId);
      await loadData();
    } catch (err: unknown) {
      alert("Fehler beim Entfernen des Teams");
    }
  };

  const handleGenerateBracket = async () => {
    try {
      await api.tournaments.start(tournamentId);
      await loadData();
    } catch (err: unknown) {
      alert("Fehler beim Starten des Turniers");
    }
  };

  const handleMatchClick = (match: Match) => {
    if (!canReferee) return;
    // Only allow if both teams are set
    if (!match.team_a_id || !match.team_b_id) return;
    setSelectedMatch(match);
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Lade Turnier…</div>;
  }
  if (error || !tournament) {
    return <div className="p-8 text-center text-destructive">{error || "Turnier nicht gefunden"}</div>;
  }

  const matchTeamA = selectedMatch?.team_a_id ? teamsMap[selectedMatch.team_a_id] : undefined;
  const matchTeamB = selectedMatch?.team_b_id ? teamsMap[selectedMatch.team_b_id] : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <Badge variant={status === "SETUP" ? "secondary" : "default"}>{status}</Badge>
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
          
          {status === "SETUP" && !myTournamentTeam && (
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger render={<Button />}>
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
                  <div className="space-y-2">
                    <Label>Dein Team</Label>
                    <Select value={selectedTeamId} onValueChange={(val) => setSelectedTeamId(val || "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Team auswählen…" />
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
                </div>
              </DialogContent>
            </Dialog>
          )}

          {status === "SETUP" && myTournamentTeam && (
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
          {canManage && <TabsTrigger value="admin" className="flex-1">Einstellungen</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
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
              {!bracket ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Der Spielplan wurde noch nicht erstellt.</p>
                  <p className="text-sm mt-1">Das Turnier befindet sich noch in der Anmeldephase.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <BracketView 
                    bracket={bracket} 
                    teamsMap={teamsMap} 
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
                      
                      {canManage && status === "SETUP" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 absolute top-2 right-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemoveTeam(team.id, team.name)}
                          title="Team entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
          teamA={{ id: matchTeamA.id, name: matchTeamA.name }}
          teamB={{ id: matchTeamB.id, name: matchTeamB.name }}
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}
