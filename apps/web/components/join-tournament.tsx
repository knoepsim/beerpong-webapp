"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamPicker } from "@/components/team-picker";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useJoinTournament } from "@/hooks/queries/tournaments";
import { useCurrentUser } from "@/hooks/queries/user";

/**
 * "Mit Team beitreten" for a tournament everybody may join: the same team choice as for an invitation (complete
 * team chosen, a team mate to invite, or a team to found). `onJoined` is for a page that goes somewhere else
 * afterwards (the tournament page itself is loaded again anyway).
 */
export function JoinTournament({
  loginRedirect,
  ...props
}: Readonly<{
  tournamentId: string;
  tournamentName: string;
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
  onJoined,
}: Readonly<{ tournamentId: string; tournamentName: string; onJoined?: () => void }>) {
  const [open, setOpen] = useState(false);
  const join = useJoinTournament(tournamentId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) join.reset();
      }}
    >
      <DialogTrigger className={buttonVariants({ size: "lg" })}>Mit Team beitreten</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turnier beitreten</DialogTitle>
          <DialogDescription>Wähle ein Team, um an {tournamentName} teilzunehmen.</DialogDescription>
        </DialogHeader>
        {/* only while open: the teams are asked for when they are needed */}
        {open && (
          <TeamPicker
            isJoining={join.isPending}
            error={join.error}
            onJoin={(team) =>
              join.mutate(team.id, {
                onSuccess: () => {
                  setOpen(false);
                  onJoined?.();
                },
              })
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
