"use client";

import { useEffect, useState } from "react";

/** The current time, updated every `intervalMs` (for texts like "seit 8 Minuten"). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
