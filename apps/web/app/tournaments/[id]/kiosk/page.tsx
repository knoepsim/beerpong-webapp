"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Tournament, TournamentTeam, Bracket, Match } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { CheckCircle2, Circle, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function KioskPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;
  const token = searchParams.get("token");
  const themeParam = searchParams.get("theme");

  const { setTheme } = useTheme();

  const [data, setData] = useState<{
    tournament: Tournament | null;
    bracket: Bracket | null;
    teams: TournamentTeam[];
  }>({
    tournament: null,
    bracket: null,
    teams: [],
  });

  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  // Force theme if parameter is provided
  useEffect(() => {
    if (themeParam === "dark") {
      setTheme("dark");
    } else if (themeParam === "light") {
      setTheme("light");
    } else {
      setTheme("light"); // Default for kiosk is light mode unless specified
    }
  }, [themeParam, setTheme]);

  useEffect(() => {
    if (!tournamentId || !token) {
      setError("Kein Token übergeben.");
      setConnecting(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const es = new EventSource(`${apiUrl}/tournaments/${tournamentId}/kiosk/stream?token=${token}`);

    es.onopen = () => {
      setConnecting(false);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setData({
          tournament: parsed.tournament,
          bracket: parsed.bracket,
          teams: parsed.teams || [],
        });
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    es.onerror = () => {
      setError("Verbindung zum Server verloren oder Token ungültig. Versuche neu zu verbinden...");
      setConnecting(true);
      es.close();
      
      // Try to reconnect after 5s
      setTimeout(() => {
        setConnecting(true);
      }, 5000);
    };

    return () => es.close();
  }, [tournamentId, token]);

  if (error && !data.tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center p-8 bg-destructive/10 text-destructive rounded-xl max-w-md">
          <Info className="w-12 h-12 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Fehler</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (connecting && !data.tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
          <p className="mt-6 text-xl font-medium text-muted-foreground animate-pulse">
            Verbinde zum Turnier...
          </p>
        </div>
      </div>
    );
  }

  if (!data.tournament) return null;

  const { tournament, bracket, teams } = data;
  const isStarted = !!tournament.started_at;

  const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/tournaments/${tournament.id}`;
  // For checkin phase, use dummy link for now as requested
  const checkinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/checkin`;

  // Determine sub-phase
  const now = new Date();
  const regEnd = tournament.registration_end_time ? new Date(tournament.registration_end_time) : null;
  const checkinStart = tournament.checkin_start_time ? new Date(tournament.checkin_start_time) : null;
  
  const isRegistrationOpen = !regEnd || now < regEnd;
  const isCheckinOpen = checkinStart && !isStarted; // If started, checkin is definitely over

  // Helper for team names
  const getTeamName = (teamId: string | null | undefined) => {
    if (!teamId) return "TBD";
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : "Unbekannt";
  };

  // Find active matches
  let activeMatches: Match[] = [];
  let upcomingMatches: Match[] = [];

  if (bracket && isStarted) {
    const hasWinner = (m: Match) => {
      if (!m.next_match_id) return false;
      return bracket.matches.some(nextM => 
        nextM.id === m.next_match_id && 
        (nextM.team_a_id === m.team_a_id || nextM.team_a_id === m.team_b_id || 
         nextM.team_b_id === m.team_a_id || nextM.team_b_id === m.team_b_id)
      );
    };

    activeMatches = bracket.matches.filter(m => 
      m.team_a_id && m.team_b_id && !hasWinner(m)
    );
    
    // Future matches where at least one team is known
    upcomingMatches = bracket.matches.filter(m => 
      (!m.team_a_id || !m.team_b_id) && !hasWinner(m)
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300 p-8">
      {/* Kiosk Header */}
      <header className="flex justify-between items-center mb-8 bg-card rounded-2xl p-6 shadow-sm border">
        <div>
          <h1 className="text-5xl font-black tracking-tight">{tournament.name}</h1>
          {tournament.location && (
            <p className="text-2xl text-muted-foreground mt-2 flex items-center">
              📍 {tournament.location}
            </p>
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          <Badge variant={isStarted ? "default" : "secondary"} className="text-2xl px-6 py-2 mb-2 font-bold">
            {isStarted ? "Turnier läuft" : isCheckinOpen ? "Check-in" : "Anmeldung"}
          </Badge>
          {connecting && <span className="text-sm text-yellow-500 font-medium">● Reconnecting...</span>}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex gap-8 h-full">
        {!isStarted ? (
          /* PRE-START VIEW (Anmeldung / Check-in) */
          <>
            {/* Left side: QR Code */}
            <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-3xl p-12 shadow-sm border relative overflow-hidden">
              <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-primary to-blue-500" />
              <h2 className="text-4xl font-bold mb-4 text-center">
                {isCheckinOpen ? "Anwesenheit bestätigen" : "Jetzt teilnehmen!"}
              </h2>
              <p className="text-xl text-muted-foreground mb-12 text-center max-w-lg">
                {isCheckinOpen 
                  ? "Scanne den QR-Code, um dein Team als 'Anwesend' zu markieren." 
                  : "Scanne den QR-Code mit der Kamera, um dein Team für dieses Turnier anzumelden."}
              </p>
              
              <div className="bg-white p-6 rounded-3xl shadow-xl ring-1 ring-black/5">
                <QRCodeSVG 
                  value={isCheckinOpen ? checkinUrl : joinUrl}
                  size={400}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>

            {/* Right side: Teams list */}
            <div className="w-[450px] bg-card rounded-3xl shadow-sm border flex flex-col overflow-hidden">
              <div className="p-6 border-b bg-muted/20">
                <h3 className="text-2xl font-bold flex justify-between items-center">
                  Teams
                  <Badge variant="secondary" className="text-xl px-3 py-1">
                    {teams.length}
                  </Badge>
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {teams.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Info className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-xl text-center">Noch keine Teams angemeldet</p>
                  </div>
                ) : (
                  teams.map((team, i) => (
                    <div 
                      key={team.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border text-xl font-medium transition-all",
                        team.is_checked_in 
                          ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400" 
                          : "bg-background"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground w-6">{i + 1}.</span>
                        <span className="truncate max-w-[200px]">{team.name}</span>
                      </div>
                      {team.is_checked_in ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        isCheckinOpen && <Circle className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          /* ACTIVE TOURNAMENT VIEW */
          <div className="flex-1 grid grid-cols-3 gap-8">
            {/* Active Matches Column */}
            <div className="col-span-2 flex flex-col gap-6">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <span className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
                </span>
                Aktuelle Spiele
              </h2>
              
              <div className="grid grid-cols-2 gap-6">
                {activeMatches.length === 0 ? (
                  <Card className="col-span-2 p-12 text-center text-muted-foreground">
                    <CardContent>
                      <p className="text-2xl">Derzeit keine Spiele aktiv.</p>
                    </CardContent>
                  </Card>
                ) : (
                  activeMatches.map((match, idx) => (
                    <Card key={match.id} className="border-2 shadow-lg overflow-hidden bg-card/50 backdrop-blur">
                      <div className="bg-muted p-3 text-center border-b">
                        <Badge variant="outline" className="text-lg bg-background font-bold tracking-wider">
                          TISCH {(idx % tournament.table_count) + 1}
                        </Badge>
                      </div>
                      <CardContent className="p-8 relative">
                        <div className="flex flex-col items-center justify-between h-full gap-6">
                          <div className="w-full">
                            <div className="text-3xl font-black text-center truncate px-4 pb-2 border-b-4 border-red-500/50 text-red-500 dark:text-red-400">
                              {getTeamName(match.team_a_id)}
                            </div>
                          </div>
                          
                          <div className="text-2xl font-bold text-muted-foreground">VS</div>
                          
                          <div className="w-full">
                            <div className="text-3xl font-black text-center truncate px-4 pt-2 border-t-4 border-blue-500/50 text-blue-500 dark:text-blue-400">
                              {getTeamName(match.team_b_id)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Matches Column */}
            <div className="flex flex-col gap-6 bg-muted/20 p-6 rounded-3xl border">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <Clock className="w-8 h-8 text-primary" />
                Bereithalten
              </h2>
              
              <div className="space-y-4 overflow-y-auto pr-2">
                {upcomingMatches.length === 0 ? (
                  <p className="text-xl text-muted-foreground text-center mt-12">
                    Keine weiteren Spiele geplant.
                  </p>
                ) : (
                  upcomingMatches.map((match) => (
                    <div key={match.id} className="bg-background rounded-xl p-5 border shadow-sm">
                      <p className="text-sm font-semibold text-muted-foreground uppercase mb-2">Als nächstes</p>
                      <div className="flex flex-col gap-2">
                        <span className="text-xl font-bold truncate">
                          {getTeamName(match.team_a_id)}
                        </span>
                        <span className="text-muted-foreground font-medium text-sm">vs</span>
                        <span className="text-xl font-bold truncate">
                          {getTeamName(match.team_b_id)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
