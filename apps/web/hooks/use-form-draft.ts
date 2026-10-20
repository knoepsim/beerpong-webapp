"use client";

import { useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

/**
 * A form that is not sent yet survives a reload or a step back in the browser: it is kept in the session storage
 * of the tab (gone with the tab). Storage can be blocked (private mode): then there is just no draft.
 */
export function readDraft<T>(key: string): Partial<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // nothing kept, nothing to clear
  }
}

/** Keeps every change of a field as the draft under `key` (a reset is no change: starting over leaves no draft). */
export function useFormDraft<T extends FieldValues>(key: string, form: UseFormReturn<T>) {
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (!name) return;
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        // without storage the form still works, only without a draft
      }
    });
    return () => subscription.unsubscribe();
  }, [key, form]);
}
