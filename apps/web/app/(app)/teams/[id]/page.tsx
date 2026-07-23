"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Link as LinkIcon, Check, Copy } from "lucide-react";

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const teamId = resolvedParams.id;
  
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTeam();
  }, [teamId]);

  const loadTeam = async () => {
    try {
      const data = await api.teams.get(teamId);
      setTeam(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden des Teams";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    setCopied(false);
    try {
      const invite = await api.teams.createInvite(teamId);
      setInviteToken(invite.token);
    } catch (err: unknown) {
      alert("Fehler beim Erstellen des Links");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!inviteToken) return;
    const url = `${window.location.origin}/teams/join/${inviteToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Lade Team…</div>;
  }
  if (error || !team) {
    return <div className="p-8 text-center text-destructive">{error || "Team nicht gefunden"}</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-20 md:pb-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{team.members.length} / {team.max_size} Mitglieder</span>
            <Badge variant={team.is_complete ? "default" : "secondary"} className="ml-2">
              {team.is_complete ? "Vollständig" : "Sucht Spieler"}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mitglieder</CardTitle>
          <CardDescription>Aktuelle Spieler in diesem Team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {team.members.map((m, idx) => (
              <div key={m.user_id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">Spieler {idx + 1}</p>
                    <p className="text-xs text-muted-foreground">ID: {m.user_id.split("-")[0]}...</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Seit {new Date(m.joined_at).toLocaleDateString("de-DE")}
                </div>
              </div>
            ))}

            {!team.is_complete && (
              <div className="pt-4 mt-4 border-t">
                {inviteToken ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Einladungslink</p>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm truncate font-mono select-all">
                        {`${window.location.origin}/teams/join/${inviteToken}`}
                      </div>
                      <Button variant="secondary" onClick={handleCopy} className="shrink-0">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={handleGenerateInvite} disabled={isGenerating} className="w-full">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Einladungslink generieren
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
