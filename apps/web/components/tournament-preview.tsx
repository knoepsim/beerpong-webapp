"use client";

import { useState } from "react";
import { Calendar, Mail, MapPin, Users } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format-when";
import { cn } from "@/lib/utils";
import type { TournamentPreview } from "@/types";

const teamsText = (n: number) => (n === 1 ? "1 Team angemeldet" : `${n} Teams angemeldet`);

/** A short description is shown whole; a long one in three lines with "Mehr". */
const isLong = (text: string) => text.length > 160 || text.includes("\n");

/**
 * What somebody sees of a tournament before taking part: enough to decide, nothing about the participants. As an
 * invitation (`invitation`) it is set apart from the tournament page: a colored head with the envelope and who
 * invites. What to do goes below (`children`).
 */
export function TournamentPreviewCard({
  preview,
  invitation,
  children,
}: Readonly<{
  preview: TournamentPreview;
  /** An invitation: the line under the name ("Simon lädt dich ein"). */
  invitation?: { from: string };
  children?: React.ReactNode;
}>) {
  const [showAll, setShowAll] = useState(false);
  const deadline = preview.registration_open && preview.registration_end_time;
  const long = !!preview.description && isLong(preview.description);

  return (
    <section aria-labelledby="preview-title" className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className={cn("px-5", invitation ? "bg-primary py-4 text-primary-foreground" : "pt-5")}>
        {invitation && (
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider opacity-90">
            <Mail className="size-3.5" aria-hidden="true" />
            Einladung
          </p>
        )}
        <h1 id="preview-title" className={cn("text-2xl font-bold leading-tight", invitation && "mt-1")}>
          {preview.name}
        </h1>
        {invitation && <p className="text-sm opacity-90">{invitation.from}</p>}
      </header>
      <div className="space-y-4 p-5">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {preview.start_time && (
            <li className="flex items-center gap-2">
              <Calendar className="size-4 shrink-0" aria-hidden="true" />
              {formatWhen(preview.start_time)}
            </li>
          )}
          {preview.location && (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {preview.location}
            </li>
          )}
          {/* no team yet says nothing worth reading; the deadline does */}
          {(preview.team_count > 0 || deadline) && (
            <li className="flex items-center gap-2">
              <Users className="size-4 shrink-0" aria-hidden="true" />
              {[preview.team_count > 0 && teamsText(preview.team_count), deadline && `Anmeldung bis ${formatWhen(deadline)}`]
                .filter(Boolean)
                .join(" · ")}
            </li>
          )}
        </ul>
        {preview.description && (
          <div>
            <div className={long && !showAll ? "line-clamp-3" : undefined}>
              <Markdown className="text-sm text-muted-foreground">{preview.description}</Markdown>
            </div>
            {long && (
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => setShowAll(!showAll)}
                aria-expanded={showAll}
              >
                {showAll ? "Weniger" : "Mehr"}
              </Button>
            )}
          </div>
        )}
        {!invitation && !preview.registration_open && <p className="text-sm font-medium">Die Anmeldung ist geschlossen.</p>}
        {children}
      </div>
    </section>
  );
}
