import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { TournamentTeam } from "@/types";

/** "5 von 8 Teams eingecheckt" with a progress bar: shows the organizer how far check-in is. */
export function CheckinSummary({ teams }: Readonly<{ teams: TournamentTeam[] }>) {
  const total = teams.length;
  const checkedIn = teams.filter((t) => t.is_checked_in).length;

  return (
    <Progress value={checkedIn} max={Math.max(total, 1)} data-testid="checkin-summary">
      <ProgressLabel>
        {checkedIn} von {total} {total === 1 ? "Team" : "Teams"} eingecheckt
      </ProgressLabel>
    </Progress>
  );
}
