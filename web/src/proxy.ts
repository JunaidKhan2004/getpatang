import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  accessCookieOptions,
  REFRESH_COOKIE,
  refreshCookieOptions,
} from "./lib/session-cookies";

const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

/** Pages that need a session. Real authorization happens on the backend for every request. */
const PROTECTED = ["/account", "/cart", "/checkout", "/seller", "/admin", "/complete-profile"];

/**
 * 1. Silently refreshes an expired access token using the refresh cookie.
 * 2. Optimistically sends signed-out visitors of protected pages to /login.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!access && refresh) {
    const tokens = await refreshTokens(refresh);
    if (tokens) {
      // Make the new access token visible to Server Components in this same request.
      request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
      request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
      const res = NextResponse.next({ request: { headers: request.headers } });
      res.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions(tokens.accessToken));
      res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
      return res;
    }
    const res = isProtected ? toLogin(request, pathname + search) : NextResponse.next();
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  if (isProtected && !access && !refresh) return toLogin(request, pathname + search);
  return NextResponse.next();
}

function toLogin(request: NextRequest, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()).data.tokens;
  } catch {
    return null;
  }
}

export const config = {
  // Skip static files, images and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
