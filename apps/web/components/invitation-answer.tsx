"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TeamPicker } from "@/components/team-picker";
import { useAcceptInvitation, useDeclineInvitation, useReopenInvitation } from "@/hooks/queries/invitations";
import { cn } from "@/lib/utils";
import type { Invitation } from "@/types";

/** Accept with a team (or get one ready first), or decline. */
function PendingAnswer({ invitation }: Readonly<{ invitation: Invitation }>) {
  const router = useRouter();
  const accept = useAcceptInvitation(invitation);
  const decline = useDeclineInvitation(invitation.id);
  const reopen = useReopenInvitation(invitation.id);

  const handleDecline = () =>
    decline
      .mutateAsync()
      .then(() => {
        toast.success(`Einladung zu ${invitation.tournament.name} abgelehnt.`, {
          action: { label: "Rückgängig", onClick: () => reopen.mutate() },
        });
        router.push("/tournaments");
      })
      .catch(() => undefined); // the toast of the mutation says why

  return (
    <div className="flex flex-col gap-4">
      <TeamPicker
        isJoining={accept.isPending}
        error={accept.error}
        waitingHint="Die Einladung wartet so lange unter Meine Turniere."
        // awaited, not an onSuccess of mutate: the invitation is loaded again as accepted before, and this part of
        // the page is gone by then
        onJoin={(team) =>
          void accept
            .mutateAsync(team.id)
            .then(() => router.replace(`/t/${invitation.tournament.slug}`))
            .catch(() => undefined) // shown at the button
        }
      />

      {/* far from the primary action */}
      <Separator />
      <Button
        variant="ghost"
        className="self-center text-destructive hover:text-destructive"
        onClick={handleDecline}
        disabled={decline.isPending}
      >
        Einladung ablehnen
      </Button>
    </div>
  );
}

/** What the invited person can do now: answer, or see what the answer was. */
export function InvitationAnswer({ invitation }: Readonly<{ invitation: Invitation }>) {
  const reopen = useReopenInvitation(invitation.id);
  const { tournament } = invitation;

  if (invitation.status === "accepted") {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          Du bist mit {invitation.team_name} dabei.
        </p>
        <Link href={`/t/${tournament.slug}`} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")}>
          Zum Turnier
        </Link>
      </div>
    );
  }
  if (invitation.status === "withdrawn") {
    return <p className="text-sm text-muted-foreground">Diese Einladung wurde zurückgezogen.</p>;
  }
  if (!tournament.registration_open) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4" aria-hidden="true" />
        Die Anmeldung ist geschlossen.
      </p>
    );
  }
  if (invitation.status === "declined") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Du hast diese Einladung abgelehnt.</p>
        <Button variant="outline" className="h-11 w-full" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
          Doch antworten
        </Button>
      </div>
    );
  }
  return <PendingAnswer invitation={invitation} />;
}

/** Who invites, in one line under the name. */
export function invitationFrom(invitation: Pick<Invitation, "invited_by_name">): string {
  return invitation.invited_by_name ? `${invitation.invited_by_name} lädt dich ein` : "Du bist eingeladen";
}
