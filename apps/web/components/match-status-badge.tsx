import { Hourglass, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_BADGE, statusLabel, statusText } from "@/lib/match-display";
import type { Match } from "@/types";

const ICONS = { waiting: Users, queued: Hourglass } as const;

/**
 * The status of an open match as a badge: icon and short text (never color alone), the full status as tooltip.
 * Live pulses gently.
 */
export function MatchStatusBadge({ match, className }: Readonly<{ match: Match; className?: string }>) {
  if (match.status === "finished") return null;
  const Icon = match.status === "waiting" || match.status === "queued" ? ICONS[match.status] : null;
  const look: { variant: (typeof STATUS_BADGE)[keyof typeof STATUS_BADGE]["variant"]; className?: string } =
    STATUS_BADGE[match.status];
  return (
    <Badge title={statusText(match) ?? undefined} variant={look.variant} className={cn(look.className, className)}>
      {Icon && <Icon aria-hidden="true" />}
      {match.status === "live" && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" aria-hidden="true" />
      )}
      {statusLabel(match)}
    </Badge>
  );
}
