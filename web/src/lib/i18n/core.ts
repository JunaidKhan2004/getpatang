import { ur } from "./ur";

/**
 * English sentences are the keys; `ur` maps them to Urdu and anything missing falls back to
 * English. Same scheme as the backend and the mobile app.
 */
export type Lang = "en" | "ur";
export const LANGS: readonly Lang[] = ["en", "ur"];
export const LANG_COOKIE = "lang";

export type TValues = Record<string, string | number | null | undefined>;
export type TFn = (text: string, values?: TValues) => string;

/** The saved choice wins; otherwise the browser's language. */
export function pickLang(saved?: string | null, acceptLanguage?: string | null): Lang {
  if (saved === "en" || saved === "ur") return saved;
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("ur") ? "ur" : "en";
}

const FSI = "\u2068";
const PDI = "\u2069";

export function translate(lang: Lang, text: string, values?: TValues): string {
  let out = lang === "ur" ? (ur[text] ?? text) : text;
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      const s = v == null ? "" : String(v);
      // In Urdu, values such as "GP-1042" keep their own direction inside the sentence.
      const isolate = lang === "ur" && s !== "" && !s.includes("/");
      out = out.split(`{${k}}`).join(isolate ? FSI + s + PDI : s);
    }
  }
  return out;
}

export const makeT =
  (lang: Lang): TFn =>
  (text, values) =>
    translate(lang, text, values);

/** Locale for Intl number and date formatting. */
export const intlLocale = (lang: Lang) => (lang === "ur" ? "ur-PK" : "en-PK");
