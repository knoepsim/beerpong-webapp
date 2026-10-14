import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VISIBILITY_OPTIONS, visibilityLabel } from "@/lib/tournament-visibility";
import type { TournamentVisibility } from "@/types";

const ITEMS = Object.fromEntries(VISIBILITY_OPTIONS.map((o) => [o.value, o.label]));

/**
 * Who can find, see and join a tournament. The trigger shows the name of the chosen option, the list
 * names each option in one line, and the full explanation of the chosen one stays visible below the field.
 */
export function VisibilitySelect({
  value,
  onChange,
  id,
}: Readonly<{ value: TournamentVisibility; onChange: (value: TournamentVisibility) => void; id?: string }>) {
  const selected = VISIBILITY_OPTIONS.find((o) => o.value === value);
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={(v) => onChange(v as TournamentVisibility)} items={ITEMS}>
        <SelectTrigger id={id} className="w-full" aria-label="Sichtbarkeit">
          <SelectValue placeholder="Wähle die Sichtbarkeit">{visibilityLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex flex-col items-start text-left">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.summary}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && <p className="text-xs text-muted-foreground">{selected.description}</p>}
    </div>
  );
}
