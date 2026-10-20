"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { RadioCards } from "@/components/radio-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateTeam, useMyTeams } from "@/hooks/queries/teams";
import { useTeamInviteLink } from "@/hooks/use-team-invite-link";
import { errorMessage } from "@/lib/errors";
import type { Team } from "@/types";

const membersText = (team: Team) => team.members.map((m) => m.name).join(" · ");

/** The teams to choose from, as cards (one team), with who plays in each and whether one is missing. */
function TeamChoice({ teams, value, onChange }: Readonly<{ teams: Team[]; value: string; onChange: (id: string) => void }>) {
  return (
    <RadioCards
      legend="Mit welchem Team?"
      name="team"
      value={value}
      onChange={onChange}
      options={teams.map((team) => ({
        value: team.id,
        title: team.name,
        description: membersText(team),
        aside: !team.is_complete && (
          <Badge variant="warning">
            {team.members.length} von {team.max_size}
          </Badge>
        ),
      }))}
    />
  );
}

/** A new team right here, without leaving the page. */
function NewTeamForm({ onCreated }: Readonly<{ onCreated: (team: Team) => void }>) {
  const [name, setName] = useState("");
  const create = useCreateTeam();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate(name.trim(), { onSuccess: onCreated });
      }}
    >
      <Label htmlFor="new-team-name">Name deines Teams</Label>
      <div className="flex gap-2">
        <Input
          id="new-team-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            create.reset();
          }}
          placeholder="z. B. Becherhelden"
          className="h-11"
          aria-invalid={create.isError}
          disabled={create.isPending}
        />
        <Button type="submit" className="h-11 shrink-0" disabled={!name.trim() || create.isPending}>
          Team gründen
        </Button>
      </div>
      {create.isError && <p className="text-sm text-destructive">{errorMessage(create.error)}</p>}
    </form>
  );
}

/**
 * Choose the team to play with, the same everywhere (joining a tournament, answering an invitation): the teams as
 * cards (a complete one is chosen already), a team that is not complete yet gets the way to its team mate, and
 * without a team one is founded right here. Joining itself is the button of the caller (`onJoin`).
 */
export function TeamPicker({
  onJoin,
  isJoining,
  error,
  waitingHint,
}: Readonly<{
  onJoin: (team: Team) => void;
  isJoining: boolean;
  /** Why joining failed, at the button. */
  error?: unknown;
  /** What waits while the team is not complete ("Die Einladung wartet so lange unter Meine Turniere."). */
  waitingHint?: string;
}>) {
  const teamsQuery = useMyTeams({ fresh: true });
  const inviteLink = useTeamInviteLink();
  const [teamId, setTeamId] = useState("");
  const [newTeam, setNewTeam] = useState(false);
  const teams = teamsQuery.data ?? [];
  // a complete team is the likely answer
  const chosen = teams.find((t) => t.id === teamId) ?? teams.find((t) => t.is_complete) ?? teams[0];

  if (teamsQuery.isPending) return <Skeleton className="h-28 w-full" />;

  return (
    <div className="space-y-4">
      {chosen && <TeamChoice teams={teams} value={chosen.id} onChange={setTeamId} />}

      {chosen?.is_complete && (
        <Button size="lg" className="h-12 w-full" disabled={isJoining} onClick={() => onJoin(chosen)}>
          {isJoining ? "Wird angemeldet…" : `Mit ${chosen.name} beitreten`}
        </Button>
      )}
      {!!error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}

      {chosen && !chosen.is_complete && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {chosen.name} braucht noch einen Mitspieler.{waitingHint && ` ${waitingHint}`}
          </p>
          <Button className="h-11 w-full" disabled={inviteLink.isPending} onClick={() => void inviteLink.share(chosen)}>
            <UserPlus aria-hidden="true" />
            Mitspieler einladen
          </Button>
        </div>
      )}

      {teams.length === 0 || newTeam ? (
        <NewTeamForm
          onCreated={(team) => {
            setTeamId(team.id);
            setNewTeam(false);
          }}
        />
      ) : (
        !chosen?.is_complete && (
          <Button variant="outline" className="h-11 w-full" onClick={() => setNewTeam(true)}>
            Neues Team gründen
          </Button>
        )
      )}
    </div>
  );
}
