"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/user-provider";
import { api } from "@/lib/api";
import type { Team } from "@/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { toast } from "sonner";

/** "Mit Team beitreten": choose one of my teams and join. `inviteToken` is the invitation link it was reached by. */
export function JoinTournament({
  tournamentId,
  tournamentName,
  inviteToken,
  loginRedirect,
  onJoined,
}: Readonly<{
  tournamentId: string;
  tournamentName: string;
  inviteToken?: string | null;
  /** Where somebody without login comes back to after logging in. */
  loginRedirect: string;
  onJoined: () => void | Promise<void>;
}>) {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setError(null);
    try {
      const mine = await api.teams.list();
      setTeams(mine);
      if (mine.length === 1) setTeamId(mine[0].id);
    } catch {
      setError("Deine Teams konnten nicht geladen werden.");
    }
  };

  const handleJoin = async () => {
    if (!teamId) return;
    setIsJoining(true);
    setError(null);
    try {
      await api.tournaments.join(tournamentId, teamId, inviteToken);
      setOpen(false);
      await onJoined();
      toast.success("Turnier erfolgreich beigetreten");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Beitreten");
    } finally {
      setIsJoining(false);
    }
  };

  if (isUserLoading) return null;
  if (!user) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`} className={buttonVariants({ size: "lg" })}>
        Anmelden und beitreten
      </Link>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ size: "lg" })}>Mit Team beitreten</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turnier beitreten</DialogTitle>
          <DialogDescription>Wähle ein Team, um an {tournamentName} teilzunehmen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {teams.length === 0 && !error ? (
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
                <Select value={teamId} onValueChange={(val) => setTeamId(val || "")}>
                  <SelectTrigger>
                    <span className={teamId ? "text-foreground" : "text-muted-foreground"}>
                      {teamId ? teams.find((t) => t.id === teamId)?.name : "Team auswählen…"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {!t.is_complete && "(Unvollständig)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleJoin} disabled={!teamId || isJoining}>
                {isJoining ? "Beitreten…" : "Jetzt teilnehmen"}
              </Button>
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
