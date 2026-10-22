import { cookies } from "next/headers";
import { Landing } from "@/components/landing";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * The start page, open without login. Whether there is a session is known here already: a visitor sees the page at
 * once (nothing to wait for), with a session the name is loaded for the greeting.
 */
export default async function HomePage() {
  const hasSession = (await cookies()).has(SESSION_COOKIE);
  return <Landing hasSession={hasSession} />;
}
