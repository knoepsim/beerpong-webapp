"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useMyTournaments } from "@/hooks/queries/tournaments";
import { LoadError } from "@/components/load-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { InvitationItem } from "@/components/invitation-item";
import { useMyInvitations } from "@/hooks/queries/invitations";
import { TournamentRoleType } from "@/types";
import { TournamentCard } from "@/components/tournament-card";
import { groupTournaments, mergeMyTournaments, type MyTournament } from "@/lib/tournament-groups";
import { buttonVariants } from "@/components/ui/button";
import { Plus, Trophy } from "lucide-react";
import { EmptyNote } from "@/components/empty-note";
import { cn } from "@/lib/utils";

function TournamentSection({ title, items }: Readonly<{ title: string; items: MyTournament[] }>) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.tournament.id}>
            <TournamentCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TournamentsPage() {
  const tournamentsQuery = useMyTournaments();
  const invitations = useMyInvitations().data ?? [];
  const data = tournamentsQuery.data;
  const organizes = !!data?.managing.some((m) => m.role === TournamentRoleType.ADMIN || m.role === TournamentRoleType.MANAGER);

  const groups = useMemo(() => (data ? groupTournaments(mergeMyTournaments(data)) : null), [data]);
  const hasTournaments = !!groups && groups.active.length + groups.planned.length + groups.finished.length > 0;

  if (tournamentsQuery.isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-4 space-y-10">
            <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meine Turniere</h1>
        {tournamentsQuery.isError && (
          <LoadError
            error={tournamentsQuery.error}
            fallback="Deine Turniere konnten nicht geladen werden."
            onRetry={() => void tournamentsQuery.refetch()}
          />
        )}
        {invitations.length > 0 && (
          <section aria-label="Einladungen" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Einladungen</h2>
            <ul className="space-y-3">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <InvitationItem invitation={invitation} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {groups && hasTournaments && (
          // a heading only appears when there is something under it
          <div className="space-y-8">
            <TournamentSection title="Aktive Turniere" items={groups.active} />
            <TournamentSection title="Geplante Turniere" items={groups.planned} />
            <TournamentSection title="Abgeschlossene Turniere" items={groups.finished} />
          </div>
        )}
        {groups && !hasTournaments && invitations.length === 0 && (
          <EmptyNote
            icon={Trophy}
            title="Noch keine Turniere"
            description="Über einen Einladungslink oder eine Turnieradresse kommst du ins erste Turnier. Oder erstelle selbst eins."
          />
        )}
      </div>

      {/* Create Tournament Button */}
      <Separator />
      <div className="flex justify-center">
        {/* the one highlighted action only for whoever organizes tournaments already; for players it is secondary */}
        <Link
          href="/tournaments/new"
          className={cn(
            buttonVariants({ size: "lg", variant: organizes ? "default" : "outline" }),
            "w-full sm:w-auto",
            organizes && "shadow-md",
          )}
        >
          <Plus aria-hidden="true" />
          Neues Turnier
        </Link>
      </div>

    </div>
  );
}
