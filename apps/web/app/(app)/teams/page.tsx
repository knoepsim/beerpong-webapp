"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const data = await api.teams.list();
      setTeams(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    
    setIsCreating(true);
    try {
      const newTeam = await api.teams.create(createName.trim());
      setCreateName("");
      router.push(`/teams/${newTeam.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Lade Teams…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-20 md:pb-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Deine Teams</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Neues Team gründen</CardTitle>
          <CardDescription>
            Erstelle ein Team und lade anschließend deine Mitspieler ein.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1 hidden sm:block">
              <Label htmlFor="team-name" className="sr-only">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Name deines Teams…"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            {/* Mobile label visible */}
            <div className="flex-1 space-y-2 sm:hidden">
              <Label htmlFor="team-name-mobile">Team Name</Label>
              <Input
                id="team-name-mobile"
                placeholder="Name deines Teams…"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <Button type="submit" disabled={isCreating || !createName.trim()} className="sm:mt-0 mt-2">
              <Plus className="mr-2 h-4 w-4" />
              Gründen
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {teams.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Du bist noch in keinem Team.</p>
          </div>
        ) : (
          teams.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/teams/${t.id}`)}
            >
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" />
                      {t.members.length} / {t.max_size} Mitglieder
                    </CardDescription>
                  </div>
                  <Badge variant={t.is_complete ? "default" : "secondary"}>
                    {t.is_complete ? "Vollständig" : "Sucht Spieler"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
