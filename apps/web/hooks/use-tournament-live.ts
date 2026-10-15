import { useEffect, useRef, useState } from "react";
import { LiveConnection, type LiveScope, type LiveStatus } from "@/lib/live-connection";

export type { LiveScope, LiveStatus };

/**
 * Keeps a tournament page up to date: the server says which parts changed, `onChange` loads exactly those.
 * The details of the connection (reconnecting, fallback, hidden tab) are in `LiveConnection`.
 */
export function useTournamentLive({
  tournamentId,
  revision,
  onChange,
}: {
  tournamentId: string | undefined;
  /** The revision of what the page currently shows. */
  revision: number | undefined;
  onChange: (scopes: LiveScope[]) => void | Promise<void>;
}): { status: LiveStatus } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const known = useRef(revision ?? 0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (revision !== undefined) known.current = Math.max(known.current, revision);
  }, [revision]);

  useEffect(() => {
    if (!tournamentId) return;
    const connection = new LiveConnection({
      tournamentId,
      known,
      onChange: (scopes) => onChangeRef.current(scopes),
      onStatus: setStatus,
    });
    connection.start();
    return () => connection.stop();
  }, [tournamentId]);

  return { status };
}
