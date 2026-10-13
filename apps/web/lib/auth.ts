export const TOKEN_KEY = "beerpong_access_token";
export const REFRESH_TOKEN_KEY = "beerpong_refresh_token";

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // Also set a cookie so the middleware can read the access token for basic route protection
    document.cookie = `${TOKEN_KEY}=${accessToken}; path=/; max-age=2592000; SameSite=Lax`;
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
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
