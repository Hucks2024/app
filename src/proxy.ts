import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { PATHNAME_HEADER } from "@/lib/headers";

// One cookie for the whole site, not one per club: it names a User row,
// and that row already says which club the account belongs to.
const SESSION_COOKIE = "pacemates_session";

// Lightweight edge-safe gate: just confirms a valid signed session exists.
// Deeper checks (verification status, admin role, ownership) happen in the
// page/server-action itself, which has real DB access.
const PROTECTED_PREFIXES = ["/activities", "/profile", "/verify", "/admin"];

// Which path the request is for, passed through as a header.
//
// The nav lives in the root layout and has to know which club's page it's
// sitting on, and a layout can't see the pathname. A header set here is the
// one place that knows it before rendering starts, which keeps the nav
// server-rendered with the right name rather than flipping to it after
// hydration.
function withPathname(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!needsAuth) return withPathname(req);

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("missing SESSION_SECRET");
    await jwtVerify(token, new TextEncoder().encode(secret));
    return withPathname(req);
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // Everything except Next's own assets and the static files in /public,
  // because the pathname header above is wanted on every page render, not
  // just the gated ones. The gate itself still only applies to
  // PROTECTED_PREFIXES.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.webmanifest$).*)"],
};
