import { Copy, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Team } from "@/types";

interface TeamCardProps {
  team: Team;
  onRename: (team: Team) => void;
  onDelete: (team: Team) => void;
  onShare: (team: Team) => void;
  onCopy: (team: Team) => void;
}

/** A team of mine: name, players, and as long as it is not full the way to invite the missing one. */
export function TeamCard({ team, onRename, onDelete, onShare, onCopy }: Readonly<TeamCardProps>) {
  const missing = team.max_size - team.members.length;

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight">{team.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{team.members.map((m) => m.name).join(" · ")}</p>
        </div>
        {/* the same icon buttons as every other list (stations, links, teams of a tournament) */}
        <div className="-mr-2 -mt-1 flex shrink-0">
          <Button variant="ghost" size="icon" className="size-10" onClick={() => onRename(team)} aria-label={`${team.name} umbenennen`}>
            <Pencil aria-hidden="true" />
          </Button>
          {/* never greyed out: the dialog says what stands in the way */}
          <Button
            variant="ghost"
            size="icon"
            className="size-10 text-destructive hover:text-destructive"
            onClick={() => onDelete(team)}
            aria-label={`${team.name} löschen`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {missing > 0 && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {missing === 1 ? "Dir fehlt noch ein Mitspieler." : `Dir fehlen noch ${missing} Mitspieler.`}
          </p>
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={() => onShare(team)}>
              <Share2 aria-hidden="true" />
              Einladen
            </Button>
            <Button variant="outline" className="h-11 flex-1" onClick={() => onCopy(team)}>
              <Copy aria-hidden="true" />
              Link kopieren
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
