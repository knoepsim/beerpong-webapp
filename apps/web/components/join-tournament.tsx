"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/queries/user";
import { useMyTeams } from "@/hooks/queries/teams";
import { useJoinTournament } from "@/hooks/queries/tournaments";
import { errorMessage } from "@/lib/errors";
import { ErrorAlert } from "@/components/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
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

/**
 * "Mit Team beitreten": choose one of my teams and join. `inviteToken` is the invitation link it was reached by;
 * `onJoined` is for a page that goes somewhere else afterwards (the tournament page itself is loaded again anyway).
 */
export function JoinTournament({
  loginRedirect,
  ...props
}: Readonly<{
  tournamentId: string;
  tournamentName: string;
  inviteToken?: string | null;
  /** Where somebody without login comes back to after logging in. */
  loginRedirect: string;
  onJoined?: () => void;
}>) {
  const { user, isLoading } = useCurrentUser();
  if (isLoading) return null;
  if (!user) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`} className={buttonVariants({ size: "lg" })}>
        Anmelden und beitreten
      </Link>
    );
  }
  return <JoinDialog {...props} />;
}

function JoinDialog({
  tournamentId,
  tournamentName,
  inviteToken,
  onJoined,
}: Readonly<{ tournamentId: string; tournamentName: string; inviteToken?: string | null; onJoined?: () => void }>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const teamsQuery = useMyTeams({ enabled: open });
  const join = useJoinTournament(tournamentId);
  const teams = teamsQuery.data ?? [];
  // the only team is chosen already
  const chosenId = teamId || (teams.length === 1 ? teams[0].id : "");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) join.reset();
  };

  const handleJoin = () => {
    if (!chosenId) return;
    join.mutate(
      { teamId: chosenId, inviteToken },
      {
        onSuccess: () => {
          setOpen(false);
          onJoined?.();
        },
      },
    );
  };

  let error: string | null = null;
  if (teamsQuery.isError) error = "Deine Teams konnten nicht geladen werden. Versuch es noch einmal.";
  else if (join.isError) error = errorMessage(join.error);

  let content: React.ReactNode;
  if (teamsQuery.isPending) {
    content = <Skeleton className="h-20 w-full" />;
  } else if (teams.length === 0 && !error) {
    content = (
      <div className="text-center py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Du bist in keinem Team. Gründe zuerst ein Team, um an Turnieren teilnehmen zu können.
        </p>
        <Button variant="outline" onClick={() => router.push("/teams")}>
          Zu meinen Teams
        </Button>
      </div>
    );
  } else {
    content = (
      <>
        <TeamSelect teams={teams} value={chosenId} onChange={setTeamId} />
        <Button className="w-full" onClick={handleJoin} disabled={!chosenId || join.isPending}>
          {join.isPending ? "Wird angemeldet…" : "Jetzt teilnehmen"}
        </Button>
        {error && (
          <ErrorAlert message={error} />
        )}
      </>
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
        <div className="space-y-4 pt-4">{content}</div>
      </DialogContent>
    </Dialog>
  );
}

function TeamSelect({ teams, value, onChange }: Readonly<{ teams: Team[]; value: string; onChange: (id: string) => void }>) {
  return (
    <div className="space-y-2">
      <Label>Dein Team</Label>
      <Select value={value} onValueChange={(val) => onChange(val || "")}>
        <SelectTrigger>
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value ? teams.find((t) => t.id === value)?.name : "Team auswählen…"}
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
  );
}
