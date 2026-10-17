import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import {
  useCheckin,
  useLeaveTournament,
  useRemoveTeam,
  useSetPhaseOpen,
  useStartTournament,
} from "@/hooks/queries/tournaments";
import { planStart } from "@/lib/tournament-phase";
import type { Tournament, TournamentTeam } from "@/types";

/**
 * What players and the organization do on the page of a tournament. Actions with consequences ask first and name
 * them; toasts and loading again come from the mutations.
 */
export function useTournamentActions(tournament: Tournament | undefined, teams: TournamentTeam[]) {
  const id = tournament?.id ?? "";
  const confirm = useConfirm();
  const leave = useLeaveTournament(id);
  const removeTeam = useRemoveTeam(id);
  const checkin = useCheckin(id);
  const setPhaseOpen = useSetPhaseOpen(id);
  const start = useStartTournament(id);

  const leaveTournament = (team: TournamentTeam) =>
    void confirm({
      title: "Turnier verlassen?",
      description: `${team.name} wird vom Turnier abgemeldet. Solange die Anmeldung offen ist, kannst du wieder beitreten.`,
      confirmLabel: "Turnier verlassen",
      destructive: true,
      action: () => leave.mutateAsync(),
    });

  const removeTeamFromTournament = (team: TournamentTeam) =>
    void confirm({
      title: `${team.name} aus dem Turnier entfernen?`,
      description:
        "Das Team ist dann nicht mehr angemeldet. Seine Spieler können es wieder anmelden, solange die Anmeldung offen ist.",
      confirmLabel: "Team entfernen",
      destructive: true,
      action: async () => {
        await removeTeam.mutateAsync(team);
      },
    });

  const setCheckedIn = (team: TournamentTeam, checkedIn: boolean) => checkin.mutate({ teamId: team.id, checkedIn });

  /** Opening the check-in has a consequence at the start: it asks once; everything else is switched right away. */
  const setOpen = (kind: "registration" | "checkin", open: boolean) => {
    if (kind === "checkin" && open) {
      void confirm({
        title: "Check-in öffnen?",
        description: "Teams können sich ab jetzt vor Ort einchecken. Wer beim Turnierstart nicht eingecheckt ist, wird entfernt.",
        confirmLabel: "Check-in öffnen",
        action: () => setPhaseOpen.mutateAsync({ kind, open }),
      });
      return;
    }
    setPhaseOpen.mutate({ kind, open });
  };

  const startTournament = () => {
    if (!tournament) return;
    const plan = planStart(tournament, teams);
    if (!plan.canStart) {
      toast.error(plan.description);
      return;
    }
    void confirm({
      title: "Turnier jetzt starten?",
      description: [
        plan.description,
        tournament.registration_open ? "Die Anmeldung wird geschlossen." : null,
        "Der Spielplan wird ausgelost; danach können keine Teams mehr dazukommen.",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: "Turnier starten",
      action: async () => {
        await start.mutateAsync();
      },
    });
  };

  return {
    leaveTournament,
    removeTeam: removeTeamFromTournament,
    setCheckedIn,
    setOpen,
    startTournament,
    isStarting: start.isPending,
  };
}
