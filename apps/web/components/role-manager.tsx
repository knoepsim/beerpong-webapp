"use client";

import { useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { PersonSearch } from "@/components/person-search";
import { RadioCards } from "@/components/radio-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useAssignRole, useRevokeRole } from "@/hooks/queries/tournaments";
import { assignableRoles, mayRevoke, ROLE_INFO, strongestRole } from "@/lib/roles";
import { TournamentRoleType, type PublicUser, type TournamentUserRole } from "@/types";

const RANK = [TournamentRoleType.ADMIN, TournamentRoleType.MANAGER, TournamentRoleType.REFEREE];

/** The roles to choose from, as cards with what each may do (all options seen at once, no dropdown). */
function RoleChoice({
  choices,
  value,
  onChange,
}: Readonly<{ choices: TournamentRoleType[]; value: TournamentRoleType; onChange: (role: TournamentRoleType) => void }>) {
  return (
    <RadioCards
      legend="Rolle"
      name="role"
      value={value}
      onChange={onChange}
      options={choices.map((role) => ({ value: role, title: ROLE_INFO[role].label, description: ROLE_INFO[role].description }))}
    />
  );
}

/** Choose the role, find the person, give it: the drawer stays open for the next one. */
function AssignRole({
  tournamentId,
  roles,
  choices,
}: Readonly<{ tournamentId: string; roles: TournamentUserRole[]; choices: TournamentRoleType[] }>) {
  const [role, setRole] = useState(choices[0]);
  const assign = useAssignRole(tournamentId);
  const label = ROLE_INFO[role].label;

  const action = (person: PublicUser) => {
    const held = roles.filter((r) => r.user_id === person.id).map((r) => r.role);
    if (held.includes(role)) {
      return <Badge variant="secondary">Ist {label}</Badge>;
    }
    const current = strongestRole(held);
    return (
      <>
        {current && <span className="text-xs text-muted-foreground">{ROLE_INFO[current].label}</span>}
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          disabled={assign.isPending}
          onClick={() => assign.mutate({ userId: person.id, role, userName: person.name })}
          aria-label={`${person.name} als ${label} hinzufügen`}
        >
          Hinzufügen
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-5">
      {choices.length > 1 ? (
        <RoleChoice choices={choices} value={role} onChange={setRole} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Du vergibst die Rolle <span className="font-medium text-foreground">{label}</span>: {ROLE_INFO[role].description}
        </p>
      )}
      <PersonSearch id="role-search" renderAction={action} />
    </div>
  );
}

/**
 * Who helps to run the tournament: the people with a role (strongest first) and "Rolle vergeben" in a drawer from
 * below. Admins give and take every role, managers only referees (the same rules as the API).
 */
export function RoleManager({
  tournamentId,
  roles,
  userRole,
}: Readonly<{ tournamentId: string; roles: TournamentUserRole[]; userRole: TournamentRoleType | null }>) {
  const confirm = useConfirm();
  const revoke = useRevokeRole(tournamentId);
  const choices = assignableRoles(userRole);
  const sorted = [...roles].sort((a, b) => RANK.indexOf(a.role) - RANK.indexOf(b.role));

  const handleRevoke = (role: TournamentUserRole) => {
    const who = role.user_name || "Diese Person";
    void confirm({
      title: "Rolle entziehen?",
      description: `${who} kann das Turnier danach nicht mehr ${role.role === TournamentRoleType.REFEREE ? "als Schiedsrichter leiten" : "verwalten"}.`,
      confirmLabel: "Rolle entziehen",
      destructive: true,
      action: async () => {
        await revoke.mutateAsync(role.id);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ItemGroup className="gap-0 divide-y rounded-lg border">
        {sorted.map((role) => {
          const name = role.user_name || "Unbekannt";
          return (
            <Item key={role.id} role="listitem">
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{name}</ItemTitle>
                <ItemDescription>{ROLE_INFO[role.role].label}</ItemDescription>
              </ItemContent>
              {mayRevoke(userRole, role.role) && (
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRevoke(role)}
                    aria-label={`${name}: Rolle ${ROLE_INFO[role.role].label} entziehen`}
                  >
                    <UserMinus aria-hidden="true" />
                  </Button>
                </ItemActions>
              )}
            </Item>
          );
        })}
      </ItemGroup>

      {choices.length > 0 && (
        <Drawer showSwipeHandle>
          <DrawerTrigger render={<Button variant="outline" className="h-11 w-full" />}>
            <UserPlus aria-hidden="true" />
            Rolle vergeben
          </DrawerTrigger>
          <DrawerContent className="sm:mx-auto sm:max-w-lg">
            {/* the content scrolls, the drawer itself is swiped */}
            <div className="overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle>Rolle vergeben</DrawerTitle>
              <DrawerDescription>Wer eine Rolle hat, hilft beim Turnier; mitspielen ist davon unabhängig.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <AssignRole tournamentId={tournamentId} roles={roles} choices={choices} />
            </div>
          </div>
</DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
