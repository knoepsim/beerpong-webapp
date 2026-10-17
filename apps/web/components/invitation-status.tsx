import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWithdrawInvitation } from "@/hooks/queries/invitations";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { TournamentInvitation } from "@/types";

const VARIANT = {
  pending: "info",
  accepted: "success",
  declined: "secondary",
  withdrawn: "secondary",
} as const satisfies Record<TournamentInvitation["status"], BadgeVariant>;

const statusText = (invitation: TournamentInvitation) => {
  switch (invitation.status) {
    case "accepted":
      return invitation.team_name ? `Dabei · ${invitation.team_name}` : "Dabei";
    case "declined":
      return "Abgelehnt";
    case "withdrawn":
      return "Entfernt";
    default:
      return "Offen";
  }
};

/** How far an invitation is, as the organization sees it. */
export function InvitationStatusPill({ invitation }: Readonly<{ invitation: TournamentInvitation }>) {
  return (
    <Badge variant={VARIANT[invitation.status]} className="max-w-40">
      <span className="truncate">{statusText(invitation)}</span>
    </Badge>
  );
}

/** A person with the state of their invitation; an open one can be taken out of their account ("x"). */
export function InvitationRow({
  tournamentId,
  invitation,
  detail,
}: Readonly<{ tournamentId: string; invitation: TournamentInvitation; detail?: string }>) {
  const withdraw = useWithdrawInvitation(tournamentId);
  return (
    <li className="flex min-h-11 items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1 truncate">
        {invitation.user_name}
        {detail && <span className="text-sm text-muted-foreground"> · {detail}</span>}
      </span>
      <InvitationStatusPill invitation={invitation} />
      {invitation.status === "pending" && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground"
          onClick={() => withdraw.mutate(invitation)}
          disabled={withdraw.isPending}
          aria-label={`Einladung an ${invitation.user_name} entfernen`}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}
