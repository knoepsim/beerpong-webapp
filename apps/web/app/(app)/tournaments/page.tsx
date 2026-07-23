"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tournament } from "@/types";
import { TournamentVisibility } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Calendar, Trophy } from "lucide-react";

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createLocation, setCreateLocation] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createTableCount, setCreateTableCount] = useState("1");
  const [createVisibility, setCreateVisibility] = useState<TournamentVisibility>(
    TournamentVisibility.PRIVATE
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const data = await api.tournaments.list();
      setTournaments(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const t = await api.tournaments.create({
        name: createName.trim(),
        location: createLocation.trim() || undefined,
        description: createDescription.trim() || undefined,
        table_count: parseInt(createTableCount) || 1,
        visibility: createVisibility,
      });
      setDialogOpen(false);
      setCreateName("");
      setCreateLocation("");
      setCreateDescription("");
      setCreateTableCount("1");
      router.push(`/tournaments/${t.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const visibilityLabel = (v: TournamentVisibility) => {
    switch (v) {
      case TournamentVisibility.PRIVATE:
        return "Privat";
      case TournamentVisibility.PUBLIC_LISTED:
        return "Öffentlich";
      case TournamentVisibility.PUBLIC_UNLISTED:
        return "Nicht gelistet";
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Turniere</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Neues Turnier
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Turnier erstellen</DialogTitle>
              <DialogDescription>
                Erstelle ein neues Bierpong-Turnier
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="t-name">Name *</Label>
                <Input
                  id="t-name"
                  placeholder="z.B. Sommerfest-Turnier"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-location">Ort</Label>
                <Input
                  id="t-location"
                  placeholder="z.B. Garten, Keller, …"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-desc">Beschreibung</Label>
                <Input
                  id="t-desc"
                  placeholder="Optionale Beschreibung"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="t-tables">Tische</Label>
                  <Input
                    id="t-tables"
                    type="number"
                    min={1}
                    max={20}
                    value={createTableCount}
                    onChange={(e) => setCreateTableCount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sichtbarkeit</Label>
                  <Select
                    value={createVisibility}
                    onValueChange={(v) => {
                      if (v) setCreateVisibility(v as TournamentVisibility)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TournamentVisibility.PRIVATE}>
                        Privat
                      </SelectItem>
                      <SelectItem value={TournamentVisibility.PUBLIC_LISTED}>
                        Öffentlich
                      </SelectItem>
                      <SelectItem value={TournamentVisibility.PUBLIC_UNLISTED}>
                        Nicht gelistet
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={isCreating || !createName.trim()}
              >
                {isCreating ? "Erstelle…" : "Turnier erstellen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tournaments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Noch keine Turniere
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Erstelle dein erstes Bierpong-Turnier!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => router.push(`/tournaments/${t.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {visibilityLabel(t.visibility)}
                  </Badge>
                </div>
                {t.description && (
                  <CardDescription className="line-clamp-1">
                    {t.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {t.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {t.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(t.created_at)}
                  </span>
                  <span>{t.table_count} {t.table_count === 1 ? "Tisch" : "Tische"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
