/** Cookie names and options, shared by Server Actions and the proxy. Edge-safe (no Node APIs). */

export const ACCESS_COOKIE = "kp_at";
export const REFRESH_COOKIE = "kp_rt";

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // matches backend REFRESH_TOKEN_TTL_DAYS

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Seconds until the JWT expires (read from its payload), so the cookie disappears with the token. */
function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000) - 10);
  } catch {
    return 60;
  }
}

export const accessCookieOptions = (accessToken: string) => ({ ...base, maxAge: secondsUntilExpiry(accessToken) });
export const refreshCookieOptions = () => ({ ...base, maxAge: REFRESH_TTL_SECONDS });
