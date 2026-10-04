import { cache } from "react";

import type { Lang } from "./core";

/**
 * The request's language for plain helpers (formatPKR, formatDate) on the server. getLang()
 * fills it in; in the browser this always reads "en", so client components use useFormat().
 */
const store = cache(() => ({ lang: "en" as Lang }));

export const currentLang = (): Lang => store().lang;

export function setCurrentLang(lang: Lang) {
  store().lang = lang;
}
