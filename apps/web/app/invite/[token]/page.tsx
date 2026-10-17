"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { JoinTournament } from "@/components/join-tournament";
import { LoadError } from "@/components/load-error";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvitePreview } from "@/hooks/queries/tournaments";
import { ApiError } from "@/lib/api";

/** /invite/{token}: the tournament behind an invitation link, with the way to join it. */
export default function InvitePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = use(params);
  const router = useRouter();
  const { data: preview, error, refetch } = useInvitePreview(token);
  const notFound = error instanceof ApiError && error.status === 404;

  let content: React.ReactNode;
  if (notFound) {
    content = (
      <section className="rounded-2xl border bg-card p-5 space-y-2">
        <h1 className="text-xl font-bold">Dieser Einladungslink gilt nicht mehr</h1>
        <p className="text-sm text-muted-foreground">
          Er wurde gelöscht oder es gibt ihn nicht. Frag den Veranstalter nach einem neuen Link.
        </p>
      </section>
    );
  } else if (error) {
    content = (
      <LoadError error={error} fallback="Der Link konnte nicht geladen werden." onRetry={() => void refetch()} />
    );
  } else if (preview) {
    content = (
      <>
        <p className="text-sm text-muted-foreground">Du bist eingeladen zu</p>
        <TournamentPreviewCard preview={preview}>
          {preview.registration_open && (
            <JoinTournament
              tournamentId={preview.tournament_id}
              tournamentName={preview.name}
              inviteToken={token}
              loginRedirect={`/invite/${token}`}
              onJoined={() => router.replace(`/t/${preview.slug}`)}
            />
          )}
        </TournamentPreviewCard>
      </>
    );
  } else {
    content = <Skeleton className="h-44 w-full rounded-2xl" />;
  }

  return <main className="mx-auto max-w-md px-4 pt-10 pb-10 space-y-4">{content}</main>;
}
