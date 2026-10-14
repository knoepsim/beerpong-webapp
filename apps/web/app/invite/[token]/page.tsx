"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/components/user-provider";
import { JoinTournament } from "@/components/join-tournament";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TournamentPreview } from "@/types";

/** /invite/{token}: the tournament behind an invitation link, with the way to join it. */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.invites
      .get(token)
      .then(setPreview)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError("Der Link konnte nicht geladen werden. Versuche es noch einmal.");
      });
  }, [token]);

  const goToTournament = useCallback(() => {
    if (preview) router.replace(`/t/${preview.slug}`);
  }, [preview, router]);

  let action: React.ReactNode = null;
  if (preview?.registration_open) {
    action = user ? (
      <JoinTournament
        tournamentId={preview.tournament_id}
        tournamentName={preview.name}
        inviteToken={token}
        onJoined={goToTournament}
      />
    ) : (
      !isUserLoading && (
        <Link
          href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
          className={buttonVariants({ size: "lg" })}
        >
          Anmelden und beitreten
        </Link>
      )
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-10 pb-10 space-y-4">
      {notFound ? (
        <section className="rounded-2xl border bg-card p-5 space-y-2">
          <h1 className="text-xl font-bold">Dieser Einladungslink gilt nicht mehr</h1>
          <p className="text-sm text-muted-foreground">
            Er wurde gelöscht oder es gibt ihn nicht. Frag den Veranstalter nach einem neuen Link.
          </p>
        </section>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : preview ? (
        <>
          <p className="text-sm text-muted-foreground">Du bist eingeladen zu</p>
          <TournamentPreviewCard preview={preview}>{action}</TournamentPreviewCard>
        </>
      ) : (
        <Skeleton className="h-44 w-full rounded-2xl" />
      )}
    </main>
  );
}
