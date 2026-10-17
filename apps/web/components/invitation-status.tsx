import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWithdrawInvitation } from "@/hooks/queries/invitations";
import { cn } from "@/lib/utils";
import type { TournamentInvitation } from "@/types";

const TONE: Record<TournamentInvitation["status"], string> = {
  pending: "border-primary/40 bg-primary/10",
  accepted: "border-success/50 bg-success/10",
  declined: "border-border bg-muted text-muted-foreground",
  withdrawn: "border-border bg-muted text-muted-foreground",
};

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
    <span className={cn("shrink-0 truncate rounded-full border px-2 py-0.5 text-xs font-medium", TONE[invitation.status])}>
      {statusText(invitation)}
    </span>
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
