import { Hourglass, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_STYLE, statusLabel, statusText } from "@/lib/match-display";
import type { Match } from "@/types";

const ICONS = { waiting: Users, queued: Hourglass } as const;

/**
 * The status of an open match as a colored badge: icon and short text (never color alone), the full status as
 * tooltip. Live pulses gently.
 */
export function MatchStatusBadge({ match, className }: Readonly<{ match: Match; className?: string }>) {
  if (match.status === "finished") return null;
  const Icon = match.status === "waiting" || match.status === "queued" ? ICONS[match.status] : null;
  return (
    <span
      title={statusText(match) ?? undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none",
        STATUS_STYLE[match.status],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {match.status === "live" && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
      )}
      {statusLabel(match)}
    </span>
  );
}
