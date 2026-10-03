import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { api, ApiError } from "./api";
import { ACCESS_COOKIE, accessCookieOptions, REFRESH_COOKIE, refreshCookieOptions } from "./session-cookies";
import type { PublicUser, Tokens } from "./types";

/** Call only from Server Actions or Route Handlers (cookies are read-only while rendering). */
export async function setSession(tokens: Tokens) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions(tokens.accessToken));
  jar.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await api<PublicUser>("/auth/me", { token });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
});

/** Redirects to sign-in (then back to `returnTo`) when nobody is signed in. */
export async function requireUser(returnTo: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!user.profile) redirect(`/complete-profile?next=${encodeURIComponent(returnTo)}`);
  return user;
}
