"use client";

import { RadioCards } from "@/components/radio-cards";
import { Badge } from "@/components/ui/badge";
import { MODES, type ModeId } from "@/lib/modes";
import type { TournamentMode } from "@/types";

/**
 * How the teams meet: the modes of the game (`modes`; all without a game). The coming ones are there to see, not to
 * choose ("Kommt bald"); nothing is chosen at first.
 */
export function ModePicker({
  modes,
  value,
  onChange,
  errorId,
  name = "mode",
}: Readonly<{
  modes?: ModeId[];
  value: TournamentMode | undefined;
  onChange: (mode: TournamentMode) => void;
  errorId?: string;
  name?: string;
}>) {
  return (
    <RadioCards<ModeId>
      legend="Turniermodus"
      name={name}
      options={MODES.filter((mode) => !modes || modes.includes(mode.id)).map((mode) => ({
        value: mode.id,
        title: mode.label,
        description: mode.description,
        disabled: !mode.available,
        aside: mode.available ? undefined : <Badge variant="outline">Kommt bald</Badge>,
      }))}
      value={value}
      // only available modes can be chosen, and those are the modes of the API
      onChange={(mode) => onChange(mode as TournamentMode)}
      errorId={errorId}
    />
  );
}
