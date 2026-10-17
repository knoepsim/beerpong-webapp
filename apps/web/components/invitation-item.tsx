import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { formatWhen } from "@/lib/format-when";
import type { Invitation } from "@/types";

/** An open invitation in "Meine Turniere": set apart from the tournaments, it leads to the invitation itself. */
export function InvitationItem({ invitation }: Readonly<{ invitation: Invitation }>) {
  const { tournament } = invitation;
  const from = invitation.invited_by_name ? `${invitation.invited_by_name} lädt dich ein` : "Über einen Einladungslink";
  return (
    <Link
      href={`/invitations/${invitation.id}`}
      className="flex min-h-16 items-center gap-3 rounded-xl border-2 border-primary/60 bg-primary/5 p-3 transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Mail className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{tournament.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {from}
          {tournament.start_time && ` · ${formatWhen(tournament.start_time)}`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
