import { cn } from "@/lib/utils";
import { STATUS_STYLE, statusLabel } from "@/lib/match-display";
import type { Match } from "@/types";

/** The status of an open match as a colored badge with text (never color alone); live pulses gently. */
export function MatchStatusBadge({ match, className }: Readonly<{ match: Match; className?: string }>) {
  if (match.status === "finished") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none",
        STATUS_STYLE[match.status],
        className,
      )}
    >
      {match.status === "live" && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
      )}
      {statusLabel(match)}
    </span>
  );
}
