import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/constants";

/** Route prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pool",
  "/applications",
  "/documents",
  "/admin",
  "/settings",
];

/** Auth screens an already-signed-in user should be bounced away from. */
const AUTH_ROUTES = ["/login", "/register", "/onboard", "/forgot-password"];

const HOME_ROUTE = "/dashboard";

/**
 * Presence gate only: it checks for the auth cookie and redirects, it does NOT
 * verify the JWT (that happens server-side via `getSession()` / the API, which
 * rejects tampered or expired tokens). Cheap, edge-safe, and never trusts a role.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (!hasSession && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL(HOME_ROUTE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and anything with a file extension (static assets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
