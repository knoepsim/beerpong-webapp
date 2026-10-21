import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { stationOf } from "@/lib/match-display";
import type { Match } from "@/types";

/** Where to go: the station of a match that is ready or live, with a pin; nothing otherwise. */
export function MatchStation({ match, className }: Readonly<{ match: Match; className?: string }>) {
  const station = stationOf(match);
  if (!station) return null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <MapPin className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{station}</span>
    </span>
  );
}
