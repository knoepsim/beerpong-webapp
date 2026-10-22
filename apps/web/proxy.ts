import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  
  // Protected routes
  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith("/tournaments") ||
    request.nextUrl.pathname.startsWith("/teams") ||
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  if (!token && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect away from login if already logged in
  if (token && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/tournaments", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // the start page (/) is open for everybody and greets by itself
  matcher: [
    "/tournaments/:path*", 
    "/teams/:path*", 
    "/profile/:path*", 
    "/admin/:path*",
    "/onboarding/:path*",
    "/login"
  ],
};
