import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { tableOf } from "@/lib/match-display";
import type { Match } from "@/types";

/** Where to go: the table of a match that is ready or live, with a pin; nothing otherwise. */
export function MatchTable({ match, className }: Readonly<{ match: Match; className?: string }>) {
  const table = tableOf(match);
  if (!table) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <MapPin className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{table}</span>
    </span>
  );
}
