import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { optionLabel, type AccessOption } from "@/lib/tournament-access";

/**
 * A choice between a few options that explain themselves: the field shows the name of the chosen option (not its
 * value), the list names each option in one line, and the full explanation of the chosen one stays below the field.
 */
export function OptionSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: Readonly<{
  label: string;
  options: AccessOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}>) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const selected = options.find((o) => o.value === value);
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={(v) => onChange(v as T)} items={items} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue>{optionLabel(options, value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
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
