"use client";

import { ChevronDown, Mail, UserPlus } from "lucide-react";
import { InvitationRow } from "@/components/invitation-status";
import { InvitePerson } from "@/components/invite-person";
import { InviteLinks } from "@/components/invite-links";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournamentInvitations } from "@/hooks/queries/invitations";
import { useTournamentInvites } from "@/hooks/queries/tournaments";
import type { TournamentInvitation, TournamentInvite } from "@/types";

const originOf = (invitation: TournamentInvitation, links: TournamentInvite[]) =>
  invitation.invite_id ? (links.find((l) => l.id === invitation.invite_id)?.label ?? "Link") : "direkt";

/**
 * The organization's invitations, in the participants tab until the start: the open ones (closed by default) and
 * "Einladen" with a person or a link in a drawer from below.
 */
export function InvitationsPanel({
  tournamentId,
  participantIds,
}: Readonly<{ tournamentId: string; participantIds: Set<string> }>) {
  const invitations = useTournamentInvitations(tournamentId).data ?? [];
  const links = useTournamentInvites(tournamentId).data ?? [];
  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <section aria-label="Einladungen" className="space-y-3">
      {pending.length > 0 && (
        <Collapsible className="rounded-xl border bg-card">
          <CollapsibleTrigger className="group flex h-11 w-full items-center gap-2 px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Mail className="size-4 text-primary" aria-hidden="true" />
            <span className="flex-1 text-left">Offene Einladungen ({pending.length})</span>
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ItemGroup className="gap-0 divide-y border-t px-3">
              {pending.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  tournamentId={tournamentId}
                  invitation={invitation}
                  detail={originOf(invitation, links)}
                />
              ))}
            </ItemGroup>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Drawer showSwipeHandle>
        <DrawerTrigger render={<Button className="h-11 w-full" />}>
          <UserPlus aria-hidden="true" />
          Einladen
        </DrawerTrigger>
        <DrawerContent className="sm:mx-auto sm:max-w-lg">
          {/* the content scrolls, the drawer itself is swiped */}
          <div className="overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Einladen</DrawerTitle>
            <DrawerDescription>Eingeladene finden das Turnier unter Meine Turniere und wählen dort ihr Team.</DrawerDescription>
          </DrawerHeader>
          <Tabs defaultValue="person" className="px-4 pb-6">
            <TabsList className="w-full">
              <TabsTrigger value="person" className="flex-1">Person</TabsTrigger>
              <TabsTrigger value="link" className="flex-1">Link</TabsTrigger>
            </TabsList>
            <TabsContent value="person" className="mt-4">
              <InvitePerson tournamentId={tournamentId} participantIds={participantIds} />
            </TabsContent>
            <TabsContent value="link" className="mt-4">
              <InviteLinks tournamentId={tournamentId} />
            </TabsContent>
          </Tabs>
        </div>
</DrawerContent>
      </Drawer>
    </section>
  );
}
