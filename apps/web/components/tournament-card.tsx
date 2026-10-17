import Link from "next/link";
import { ChevronRight, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_ICONS } from "@/components/status-icons";
import { listStatus, type StatusTone } from "@/lib/my-status";
import { phaseLabel } from "@/lib/tournament-phase";
import type { MyTournament } from "@/lib/tournament-groups";
import { cn } from "@/lib/utils";
import { TournamentRoleType, type TournamentPhase } from "@/types";

const ROLE_LABELS: Record<TournamentRoleType, string> = {
  [TournamentRoleType.ADMIN]: "Admin",
  [TournamentRoleType.MANAGER]: "Manager",
  [TournamentRoleType.REFEREE]: "Schiedsrichter",
};

const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric" });
// "Okt." -> "Okt": the tile is too small for the dot
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short" });

// the date tile names the day already: the text adds only the time
const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/** The date of the tournament as a small calendar tile: the first thing the eye looks for in an event list. */
function DateTile({ iso, phase }: Readonly<{ iso: string; phase: TournamentPhase }>) {
  const date = new Date(iso);
  return (
    <div
      className={cn(
        "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none",
        phase === "running" && "bg-primary text-primary-foreground",
        phase === "finished" && "bg-muted text-muted-foreground",
        phase !== "running" && phase !== "finished" && "bg-primary/10 text-primary",
      )}
      aria-hidden="true"
    >
      <span className="text-xl font-bold tabular-nums">{DAY.format(date)}</span>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">{MONTH.format(date).replace(".", "")}</span>
    </div>
  );
}

/** Like the status card: tinted and bordered by urgency, the icon carries the color, the text stays readable. */
const TONE: Record<StatusTone, { pill: string; icon: string }> = {
  urgent: { pill: "border-destructive/50 bg-destructive/10", icon: "text-destructive" },
  attention: { pill: "border-warning/50 bg-warning/10", icon: "text-warning" },
  active: { pill: "border-primary/50 bg-primary/10", icon: "text-primary" },
  relaxed: { pill: "", icon: "text-muted-foreground" },
  done: { pill: "border-success/50 bg-success/10", icon: "text-success" },
};

/**
 * The state is only worth a badge while the tournament is being prepared (registration open or closed, check-in), and
 * only for organizers: a player gets their own status instead ("Jetzt einchecken", "Eingecheckt"). "running" and
 * "finished" are already said by the heading of the group the card is in.
 */
const isPreparing = (phase: TournamentPhase) => phase !== "running" && phase !== "finished";

/**
 * A tournament in the list: when (date tile), what (name), where and at what time, the state, and how I am
 * involved (a badge with my team if I play, a badge per role if I organize; both if I do both). Nothing else; everything else is on the tournament page.
 */
export function TournamentCard({ item }: Readonly<{ item: MyTournament }>) {
  const { tournament: t, team, role, participation } = item;
  const when = t.start_time ?? t.created_at;
  const status = participation ? listStatus(t, participation) : null;
  const StatusIcon = status ? STATUS_ICONS[status.icon] : null;

  return (
    <Link
      href={`/t/${t.slug}`}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs outline-hidden transition",
        "hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <DateTile iso={when} phase={t.phase} />

      <div className="min-w-0 flex-1 space-y-1.5">
        <h4 className={cn("line-clamp-2 font-semibold leading-tight", t.phase === "finished" && "text-muted-foreground")}>
          {t.name}
        </h4>

        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <span>{TIME.format(new Date(when))} Uhr</span>
          {t.location && (
            <>
              <span aria-hidden="true">·</span>
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.location}</span>
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {status && StatusIcon && (
            <Badge variant="outline" className={cn("font-semibold", TONE[status.tone].pill)}>
              <StatusIcon className={TONE[status.tone].icon} aria-hidden="true" />
              {status.text}
            </Badge>
          )}
          {role && isPreparing(t.phase) && <Badge variant="outline">{phaseLabel(t.phase)}</Badge>}
          {team && (
            <Badge variant="secondary" className="max-w-full">
              <Users aria-hidden="true" />
              <span className="truncate">{team.name}</span>
            </Badge>
          )}
          {role && <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>}
        </div>
      </div>

      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
