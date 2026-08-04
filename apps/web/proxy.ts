import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("beerpong_access_token")?.value;
  
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

  // Redirect from root to tournaments or login
  if (request.nextUrl.pathname === "/") {
    if (token) {
        return NextResponse.redirect(new URL("/tournaments", request.url));
    } else {
        return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/tournaments/:path*", 
    "/teams/:path*", 
    "/profile/:path*", 
    "/admin/:path*",
    "/onboarding/:path*",
    "/login"
  ],
};
