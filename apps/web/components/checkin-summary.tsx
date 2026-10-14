import type { TournamentTeam } from "@/types";

/** "5 von 8 Teams eingecheckt" with a progress bar: shows the organizer how far check-in is. */
export function CheckinSummary({ teams }: { teams: TournamentTeam[] }) {
  const total = teams.length;
  const checkedIn = teams.filter((t) => t.is_checked_in).length;
  const percent = total === 0 ? 0 : Math.round((checkedIn / total) * 100);

  return (
    <div className="space-y-1.5" data-testid="checkin-summary">
      <p className="text-sm font-medium">
        {checkedIn} von {total} {total === 1 ? "Team" : "Teams"} eingecheckt
      </p>
      <div
        role="progressbar"
        aria-label="Check-in-Fortschritt"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={checkedIn}
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
