"use client";

import { use } from "react";
import { InvitationAnswer, invitationFrom } from "@/components/invitation-answer";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvitation } from "@/hooks/queries/invitations";
import { ApiError } from "@/lib/api";

/** /invitations/{id}: one of my invitations, with the answer. Not the tournament page: that comes after joining. */
export default function InvitationPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const { data: invitation, error, refetch } = useInvitation(id);

  let content: React.ReactNode;
  if (error instanceof ApiError && error.status === 404) {
    content = (
      <section className="space-y-2 rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-bold">Diese Einladung gibt es nicht</h1>
        <p className="text-sm text-muted-foreground">Sie gehört zu einem anderen Konto oder wurde gelöscht.</p>
      </section>
    );
  } else if (error) {
    content = (
      <LoadError error={error} fallback="Die Einladung konnte nicht geladen werden." onRetry={() => void refetch()} />
    );
  } else if (invitation) {
    content = (
      <TournamentPreviewCard preview={invitation.tournament} invitation={{ from: invitationFrom(invitation) }}>
        <InvitationAnswer invitation={invitation} />
      </TournamentPreviewCard>
    );
  } else {
    content = <Skeleton className="h-80 w-full rounded-2xl" />;
  }

  return <main className="mx-auto max-w-md px-4 pt-6 pb-24 md:pb-8">{content}</main>;
}
