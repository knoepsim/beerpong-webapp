import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the page is visible, and once when it becomes visible again.
 * Keeps a page "live" (bracket, results) without work for a tab nobody looks at.
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void latest.current();
    };
    const timer = setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intervalMs]);
}
