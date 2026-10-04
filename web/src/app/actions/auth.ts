"use server";

import { redirect } from "next/navigation";

import { api, ApiError } from "@/lib/api";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "@/lib/session";
import { type FormState, isSeller, isStaff, type PublicUser, type Tokens } from "@/lib/types";
import { safeNext } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function fail(e: unknown, values?: Record<string, string>): Promise<FormState> {
  if (e instanceof ApiError) return { error: e.message, fieldErrors: e.fieldErrors, values };
  console.error(e);
  const t = await getT();
  return { error: t("Something went wrong. Please try again."), values };
}

/** Where a user lands after signing in when no `next` was requested. */
function homeFor(user: PublicUser) {
  if (isStaff(user)) return "/admin";
  if (isSeller(user)) return "/seller";
  return "/account";
}

async function startSession(session: { user: PublicUser; tokens: Tokens }, next: string): Promise<never> {
  await setSession(session.tokens);
  if (!session.user.profile) redirect(`/complete-profile?next=${encodeURIComponent(safeNext(next, homeFor(session.user)))}`);
  redirect(safeNext(next, homeFor(session.user)));
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const identifier = str(fd, "identifier");
  const next = str(fd, "next");
  let session: { user: PublicUser; tokens: Tokens };
  try {
    session = await api("/auth/login", { method: "POST", body: { identifier, password: String(fd.get("password") ?? "") } });
  } catch (e) {
    if (e instanceof ApiError && e.code === "ACCOUNT_NOT_VERIFIED" && identifier.includes("@")) {
      redirect(`/verify?email=${encodeURIComponent(identifier.toLowerCase())}&notice=unverified`);
    }
    return fail(e, { identifier });
  }
  return startSession(session, next);
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const t = await getT();
  const values = { fullName: str(fd, "fullName"), email: str(fd, "email"), phone: str(fd, "phone").replace(/[\s-]/g, "") };
  if (fd.get("password") !== fd.get("confirmPassword")) {
    return { fieldErrors: { confirmPassword: (await getT())("Passwords do not match") }, values };
  }
  if (!fd.get("terms")) return { error: t("Please accept the Terms and Privacy Policy to continue."), values };
  try {
    await api("/auth/register", {
      method: "POST",
      body: { ...values, phone: values.phone || undefined, password: String(fd.get("password") ?? "") },
    });
  } catch (e) {
    return fail(e, values);
  }
  redirect(`/verify?email=${encodeURIComponent(values.email.toLowerCase())}`);
}

export async function verifyAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  let session: { user: PublicUser; tokens: Tokens };
  try {
    session = await api("/auth/verify-otp", { method: "POST", body: { email, code: str(fd, "code") } });
  } catch (e) {
    return fail(e);
  }
  return startSession(session, str(fd, "next"));
}

export async function resendCodeAction(email: string, purpose: "VERIFY_ACCOUNT" | "RESET_PASSWORD"): Promise<FormState> {
  try {
    await api("/auth/resend-otp", { method: "POST", body: { email, purpose } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  try {
    await api("/auth/forgot-password", { method: "POST", body: { email } });
  } catch (e) {
    return fail(e, { email });
  }
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("newPassword") !== fd.get("confirmPassword")) return { fieldErrors: { confirmPassword: (await getT())("Passwords do not match") } };
  try {
    await api("/auth/reset-password", {
      method: "POST",
      body: { email: str(fd, "email"), code: str(fd, "code"), newPassword: String(fd.get("newPassword") ?? "") },
    });
  } catch (e) {
    return fail(e);
  }
  redirect("/login?notice=password-reset");
}

export async function saveProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { displayName: str(fd, "displayName"), city: str(fd, "city"), bio: str(fd, "bio") };
  const token = await getAccessToken();
  if (!token) redirect("/login?next=/complete-profile");
  let user: PublicUser;
  try {
    user = await api("/users/me/profile", {
      method: "PUT",
      token,
      body: { displayName: values.displayName, city: values.city || undefined, bio: values.bio || undefined },
    });
  } catch (e) {
    return fail(e, values);
  }
  redirect(safeNext(str(fd, "next"), homeFor(user)));
}

export async function logoutAction(): Promise<void> {
  const [token, refreshToken] = [await getAccessToken(), await getRefreshToken()];
  if (token && refreshToken) {
    // Best effort: the local session is cleared even if the server call fails.
    await api("/auth/logout", { method: "POST", token, body: { refreshToken } }).catch(() => undefined);
  }
  await clearSession();
  redirect("/");
}
