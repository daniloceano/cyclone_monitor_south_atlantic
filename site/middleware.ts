/**
 * Next.js Edge Middleware — password protection.
 *
 * Every request to the app (except login, API auth routes, and static assets)
 * is checked for a valid "cyclone-auth" httpOnly cookie.  Users without it
 * are redirected to /login.
 *
 * Security note:
 *   This is a soft-barrier suitable for an MVP private demo.  The static JSON
 *   files in /data/ are accessible without authentication (they are served
 *   directly by Vercel's CDN and cannot be gated by middleware without a
 *   custom server).  For stricter access control, serve data through API
 *   routes instead of public/.
 *
 * Configuration:
 *   Set SITE_PASSWORD in .env (local) or Vercel dashboard (production).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/data/")
  ) {
    return NextResponse.next();
  }

  // Check auth cookie
  const auth = request.cookies.get("cyclone-auth");
  if (!auth || auth.value !== "authenticated") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all paths except static files handled by Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|data/).*)"],
};
