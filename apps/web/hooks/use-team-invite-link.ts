import { useCreateTeamInvite } from "@/hooks/queries/teams";
import { copyLink, shareOrCopy } from "@/lib/share";
import type { Team } from "@/types";

const COPIED = "Einladungslink kopiert.";

/** A new invitation link for a team mate, shared or copied (a failure is a toast of the mutation). */
export function useTeamInviteLink() {
  const create = useCreateTeamInvite();
  const linkFor = async (team: Pick<Team, "id">) =>
    `${window.location.origin}/teams/join/${(await create.mutateAsync(team.id)).token}`;

  return {
    copy: async (team: Pick<Team, "id">) => {
      const link = await linkFor(team).catch(() => null);
      if (link) await copyLink(link, COPIED);
    },
    share: async (team: Pick<Team, "id" | "name">) => {
      const link = await linkFor(team).catch(() => null);
      if (!link) return;
      await shareOrCopy(
        { title: `Komm in mein Team: ${team.name}`, text: `Tritt meinem Team "${team.name}" bei Beerpong bei!`, url: link },
        COPIED,
      );
    },
    isPending: create.isPending,
  };
}
