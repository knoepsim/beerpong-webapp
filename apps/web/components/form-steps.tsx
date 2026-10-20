"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FieldErrors, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface FormStep<T extends FieldValues> {
  id: string;
  title: string;
  /** What is checked before going on. */
  fields: readonly FieldPath<T>[];
}

/**
 * A form in steps (one react-hook-form for all): going on checks only the fields of the step and focuses the
 * first wrong one; steps already reached can be opened again. After a refused submit `showFirstError` opens the
 * first step with an error.
 */
export function useFormSteps<T extends FieldValues>(form: UseFormReturn<T>, steps: readonly FormStep<T>[]) {
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);

  const next = async () => {
    if (!(await form.trigger([...steps[index].fields], { shouldFocus: true }))) return;
    const following = Math.min(index + 1, steps.length - 1);
    setIndex(following);
    setReached((r) => Math.max(r, following));
  };

  return {
    index,
    reached,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    next,
    back: () => setIndex((i) => Math.max(0, i - 1)),
    goTo: (i: number) => {
      if (i <= reached) setIndex(i);
    },
    showFirstError: (errors: FieldErrors<T>) => {
      const first = steps.findIndex((step) => step.fields.some((field) => field.split(".")[0] in errors));
      if (first >= 0) setIndex(first);
    },
  };
}

/** Where am I and how far is it: "Schritt 2 von 4 · Zeitplan" and a track; reached steps can be tapped. */
export function StepProgress({
  steps,
  index,
  reached,
  onGoTo,
}: Readonly<{ steps: readonly { id: string; title: string }[]; index: number; reached: number; onGoTo: (i: number) => void }>) {
  return (
    <nav aria-label="Schritte" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Schritt {index + 1} von {steps.length} · <span className="font-medium text-foreground">{steps[index].title}</span>
      </p>
      <ol className="flex gap-1.5">
        {steps.map((step, i) => (
          <li key={step.id} className="flex-1">
            <button
              type="button"
              onClick={() => onGoTo(i)}
              disabled={i > reached}
              aria-current={i === index ? "step" : undefined}
              aria-label={i < index ? `${step.title} (erledigt)` : step.title}
              // the track is thin, the target is not (Fitts)
              className="group flex w-full flex-col gap-1.5 py-2 text-left disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-colors",
                  i <= index && "bg-primary",
                  i > index && i <= reached && "bg-primary/40",
                  i > reached && "bg-muted",
                )}
              />
              <span
                className={cn(
                  "hidden truncate text-xs sm:block",
                  i === index ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * One step: stays mounted while hidden (values and errors stay), and its heading takes the focus when it is shown
 * (screen readers hear where they are).
 */
export function StepSection({
  id,
  title,
  active,
  children,
}: Readonly<{ id: string; title: string; active: boolean; children: ReactNode }>) {
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (active && mounted.current) heading.current?.focus();
    mounted.current = true;
  }, [active]);

  return (
    <section aria-labelledby={`${id}-title`} hidden={!active} className="flex flex-col gap-5">
      <h2 id={`${id}-title`} ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
        {title}
      </h2>
      {children}
    </section>
  );
}
