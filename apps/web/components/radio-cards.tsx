"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description?: string;
  /** At the end of the card, e.g. a badge. */
  aside?: ReactNode;
}

/**
 * One of a few options as cards to tap (a shadcn RadioGroup): the whole card is the target, the chosen one is
 * outlined. For choices that need a line of explanation each (a team with its players, a role with what it may do).
 */
export function RadioCards<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: Readonly<{
  legend: string;
  /** Unique on the page: the ids of the options start with it. */
  name: string;
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
}>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium">{legend}</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
        {options.map((option) => (
          <Label
            key={option.value}
            htmlFor={`${name}-${option.value}`}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              value === option.value && "border-primary ring-1 ring-primary",
            )}
          >
            <RadioGroupItem id={`${name}-${option.value}`} value={option.value} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{option.title}</span>
              {option.description && (
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              )}
            </span>
            {option.aside}
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
