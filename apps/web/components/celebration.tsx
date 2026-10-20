"use client";

import { useEffect, useRef, useState } from "react";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";

/** The colors of the app: primary violet, the gold of the trophy, white. */
const COLORS = ["#7c3aed", "#a78bfa", "#f59e0b", "#fcd34d", "#ffffff"];

const seenKey = (id: string) => `celebrated:${id}`;

function alreadySeen(id: string): boolean {
  try {
    return localStorage.getItem(seenKey(id)) !== null;
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(seenKey(id), "1");
  } catch {
    // private mode: then it celebrates again next time, no harm
  }
}

/**
 * Confetti for the high point of a tournament (Peak-End): once per tournament and device, and not at all for
 * somebody who asked for less motion. The canvas lies over the page and lets every touch through.
 */
export function Celebration({ id }: Readonly<{ id: string }>) {
  const ref = useRef<ConfettiRef>(null);
  const [show] = useState(() => {
    if (typeof window === "undefined") return false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    return !reduced && !alreadySeen(id);
  });

  useEffect(() => {
    if (!show) return;
    markSeen(id);
    const fire = (x: number, angle: number) =>
      ref.current?.fire({ particleCount: 80, spread: 70, startVelocity: 55, angle, origin: { x, y: 0.75 }, colors: COLORS });
    void fire(0.1, 60);
    void fire(0.9, 120);
    const later = setTimeout(() => void fire(0.5, 90), 350);
    return () => clearTimeout(later);
  }, [show, id]);

  if (!show) return null;
  return <Confetti ref={ref} manualstart aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
