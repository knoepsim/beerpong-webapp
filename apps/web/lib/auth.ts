/**
 * The session lives in HttpOnly cookies that the server sets: this code never sees a token (and so no script on the
 * page does either). See lib/api.ts for how it is renewed.
 */

/** Ends the session on the server (the cookies are cleared there) and goes to the start page. */
export async function logout(): Promise<void> {
  const { api } = await import("./api");
  await api.auth.logout().catch(() => undefined);
  window.location.href = "/";
}

/**
 * Resolve a user-controlled redirect target (e.g. the `?redirect=` query
 * parameter) to a same-origin path, or `null` if it points anywhere else.
 * Parsing against our own origin rejects `javascript:` URLs, absolute URLs
 * to other hosts and protocol-relative (`//host`, `/\host`) targets.
 */
export function toSafeRedirectPath(target: string | null | undefined): string | null {
  if (!target || typeof window === "undefined") return null;
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** The validated `?redirect=` target of the current page, if any. */
export function getRedirectParam(): string | null {
  if (typeof window === "undefined") return null;
  return toSafeRedirectPath(new URLSearchParams(window.location.search).get("redirect"));
}
