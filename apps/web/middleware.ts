import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("beerpong_access_token")?.value;

  // Protected routes: everything except /login, / and static assets
  const publicPaths = ["/login", "/"];
  const isPublic = publicPaths.includes(pathname);

  if (!isPublic && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → skip login page
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/tournaments", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
