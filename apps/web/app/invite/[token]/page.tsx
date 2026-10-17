"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentPreviewCard } from "@/components/tournament-preview";
import { LoadError } from "@/components/load-error";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInviteLink } from "@/hooks/queries/invitations";
import { useInvitePreview } from "@/hooks/queries/tournaments";
import { useCurrentUser } from "@/hooks/queries/user";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function LinkGone() {
  return (
    <section className="space-y-2 rounded-2xl border bg-card p-5">
      <h1 className="text-xl font-bold">Dieser Einladungslink gilt nicht mehr</h1>
      <p className="text-sm text-muted-foreground">
        Er wurde gelöscht oder es gibt ihn nicht. Frag den Veranstalter nach einem neuen Link.
      </p>
    </section>
  );
}

/**
 * /invite/{token}: a visitor sees what it is about and logs in; whoever is logged in gets the invitation into their
 * account and lands on it (or on the tournament, if they play already). The link is not needed after that.
 */
export default function InviteLinkPage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = use(params);
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const preview = useInvitePreview(token);
  const keep = useAcceptInviteLink();
  const asked = useRef(false);

  useEffect(() => {
    if (!user || asked.current) return;
    asked.current = true;
    keep.mutate(token, {
      onSuccess: (invitation) =>
        router.replace(
          invitation.status === "accepted" ? `/t/${invitation.tournament.slug}` : `/invitations/${invitation.id}`,
        ),
    });
  }, [user, token, keep, router]);

  const gone = [preview.error, keep.error].some((error) => error instanceof ApiError && error.status === 404);
  let content: React.ReactNode;
  if (gone) {
    content = <LinkGone />;
  } else if (preview.error || keep.error) {
    content = (
      <LoadError
        error={preview.error ?? keep.error}
        fallback="Der Link konnte nicht geladen werden."
        onRetry={() => {
          asked.current = false;
          keep.reset();
          void preview.refetch();
        }}
      />
    );
  } else if (preview.data && !isUserLoading && !user) {
    content = (
      <TournamentPreviewCard preview={preview.data} invitation={{ from: "Du bist eingeladen" }}>
        {preview.data.registration_open ? (
          <>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
              className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}
            >
              Anmelden, um zu antworten
            </Link>
            <p className="text-sm text-muted-foreground">
              Danach findest du die Einladung jederzeit unter Meine Turniere.
            </p>
          </>
        ) : (
          <p className="text-sm font-medium">Die Anmeldung ist geschlossen.</p>
        )}
      </TournamentPreviewCard>
    );
  } else {
    // logged in: on the way to the invitation
    content = <Skeleton className="h-80 w-full rounded-2xl" />;
  }

  return <main className="mx-auto max-w-md px-4 pt-10 pb-10">{content}</main>;
}
