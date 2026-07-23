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
import { MapPin, Calendar, Users, Edit, Trash2, Play, Trophy } from "lucide-react";
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const loadData = async () => {
    try {
      const [tData, teamsData, rolesData, myTeamsData] = await Promise.all([
        api.tournaments.get(tournamentId),
        api.teams.list(), // using this to resolve all team names for now
        api.roles.list(tournamentId),
        api.teams.list() // currently list returns user teams
      ]);
      setTournament(tData);
      setAllTeams(teamsData);
      setRoles(rolesData);
      setMyTeams(myTeamsData);

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

  const handleJoin = async () => {
    if (!selectedTeamId) return;
    setIsJoining(true);
    try {
      await api.tournaments.join(tournamentId, selectedTeamId);
      setJoinDialogOpen(false);
      // reload to reflect changes, though we don't list teams explicitly yet unless we add an endpoint
      alert("Erfolgreich beigetreten!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Beitreten";
      alert(message);
    } finally {
      setIsJoining(false);
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
              {tournament.location && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {tournament.location}</span>
              )}
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {tournament.table_count} Tische</span>
            </div>
          </div>
          
          {status === "SETUP" && (
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
        </div>

        {tournament.description && (
          <p className="text-muted-foreground">{tournament.description}</p>
        )}
      </div>

      <Tabs defaultValue="bracket" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="bracket">Spielplan</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          {canManage && <TabsTrigger value="admin" className="hidden md:flex">Admin</TabsTrigger>}
        </TabsList>

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
                <BracketView 
                  bracket={bracket} 
                  teamsMap={teamsMap} 
                  onMatchClick={canReferee ? handleMatchClick : undefined}
                />
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
              {/* Note: Missing endpoint to fetch tournament teams cleanly without bracket, 
                  for now we just list all teams we know about or show a placeholder */}
              <p className="text-muted-foreground italic">
                Die Teilnehmerliste wird bald verfügbar sein.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="admin" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Turnier-Verwaltung</CardTitle>
                <CardDescription>Aktionen für Administratoren und Manager</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status === "SETUP" && (
                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <h3 className="font-semibold">Turnier starten</h3>
                    <p className="text-sm text-muted-foreground">
                      Sobald alle Teams angemeldet sind, kannst du das Bracket generieren lassen.
                      Danach ist keine Anmeldung mehr möglich.
                    </p>
                    <Button onClick={handleGenerateBracket} className="w-full sm:w-auto">
                      <Play className="mr-2 h-4 w-4" />
                      Spielplan generieren
                    </Button>
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1">
                    <Edit className="mr-2 h-4 w-4" /> Bearbeiten
                  </Button>
                  {userRole === TournamentRoleType.ADMIN && (
                    <Button variant="destructive" className="flex-1">
                      <Trash2 className="mr-2 h-4 w-4" /> Löschen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
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
