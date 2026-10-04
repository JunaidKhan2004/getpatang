"use server";

import { cookies } from "next/headers";

import { api } from "@/lib/api";
import { LANG_COOKIE } from "@/lib/i18n/core";
import { getAccessToken } from "@/lib/session";

/** Saves the visitor's language. Signed-in users also get emails and notifications in it. */
export async function setLanguageAction(lang: "en" | "ur") {
  if (lang !== "en" && lang !== "ur") return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const token = await getAccessToken();
  if (token) await api("/users/me/locale", { method: "PUT", token, body: { locale: lang } }).catch(() => undefined);
}
