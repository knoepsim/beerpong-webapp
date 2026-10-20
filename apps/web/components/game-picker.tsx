"use client";

import { GAME_LIST, GAMES, type GameDefinition } from "@/components/games";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Game } from "@/types";

/**
 * What is played: a list to search (more games will come). Nothing is chosen until the organizer chooses.
 * Takes the id and aria attributes of a form field (FormControl) for its input.
 */
export function GamePicker({
  value,
  onChange,
  disabled = false,
  ...inputProps
}: Readonly<{
  value: Game | undefined;
  onChange: (game: Game | undefined) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>) {
  return (
    <Combobox<GameDefinition>
      items={GAME_LIST}
      value={value ? GAMES[value] : null}
      onValueChange={(game) => onChange(game?.id)}
      itemToStringLabel={(game) => game.label}
      itemToStringValue={(game) => game.id}
      disabled={disabled}
    >
      <ComboboxInput placeholder="Spiel suchen" className="w-full" disabled={disabled} {...inputProps} />
      <ComboboxContent>
        <ComboboxEmpty>Kein Spiel gefunden.</ComboboxEmpty>
        <ComboboxList>
          {(game: GameDefinition) => (
            // a finger needs more than a line of text (Fitts)
            <ComboboxItem key={game.id} value={game} className="min-h-10">

              {game.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
