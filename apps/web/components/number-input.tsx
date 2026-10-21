"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A whole number for a form field: shows nothing for an empty field (NaN) and gives the number as it is typed
 * (no coercion, the schema checks it). Takes the field of react-hook-form and its id/aria attributes.
 */
export function NumberInput({
  value,
  onChange,
  className,
  ...props
}: Readonly<Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & { value: number | undefined; onChange: (value: number) => void }>) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      className={cn("max-w-32", className)}
      {...props}
      value={value === undefined || Number.isNaN(value) ? "" : value}
      onChange={(e) => onChange(e.target.valueAsNumber)}
    />
  );
}
