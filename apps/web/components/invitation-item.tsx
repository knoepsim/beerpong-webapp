import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatWhen } from "@/lib/format-when";
import type { Invitation } from "@/types";

/** An open invitation in "Meine Turniere": set apart from the tournaments, it leads to the invitation itself. */
export function InvitationItem({ invitation }: Readonly<{ invitation: Invitation }>) {
  const { tournament } = invitation;
  const from = invitation.invited_by_name ? `${invitation.invited_by_name} lädt dich ein` : "Über einen Einladungslink";
  return (
    <Item
      variant="outline"
      className="border-2 border-primary/60 bg-primary/5 hover:bg-primary/10"
      render={<Link href={`/invitations/${invitation.id}`} />}
    >
      <ItemMedia variant="icon" className="text-primary">
        <Mail aria-hidden="true" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="truncate">{tournament.name}</ItemTitle>
        <ItemDescription className="truncate">
          {from}
          {tournament.start_time && ` · ${formatWhen(tournament.start_time)}`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRight className="text-muted-foreground" aria-hidden="true" />
      </ItemActions>
    </Item>
  );
}
