import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LANG_COOKIE, type Lang, makeT, pickLang, type TFn } from "./core";
import { setCurrentLang } from "./current";

/** Language for this request: the `lang` cookie, else the browser's Accept-Language. */
export const getLang = cache(async (): Promise<Lang> => {
  try {
    const [c, h] = await Promise.all([cookies(), headers()]);
    const lang = pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
    setCurrentLang(lang);
    return lang;
  } catch {
    return "en"; // outside a request (build time)
  }
});

export async function getT(): Promise<TFn> {
  return makeT(await getLang());
}
