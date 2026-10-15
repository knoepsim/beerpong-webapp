import { Calendar, MapPin } from "lucide-react";
import { formatWhen } from "@/lib/format-when";
import type { TournamentPreview } from "@/types";

/** What a stranger sees of a tournament: enough to decide, nothing about the participants. */
export function TournamentPreviewCard({
  preview,
  children,
}: Readonly<{ preview: TournamentPreview; children?: React.ReactNode }>) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
      <h1 className="text-2xl font-bold leading-tight">{preview.name}</h1>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        {preview.start_time && (
          <p className="flex items-center gap-2">
            <Calendar className="size-4 shrink-0" aria-hidden="true" />
            {formatWhen(preview.start_time)}
          </p>
        )}
        {preview.location && (
          <p className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {preview.location}
          </p>
        )}
      </div>
      {!preview.registration_open && (
        <p className="text-sm font-medium">Die Anmeldung ist geschlossen.</p>
      )}
      {children}
    </section>
  );
}
