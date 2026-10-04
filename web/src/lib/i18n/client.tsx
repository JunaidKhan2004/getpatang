"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

import { formatDate, formatPKR } from "../market";
import { timeAgo } from "../notifications";
import { type Lang, makeT, type TFn, type TValues } from "./core";

const LangContext = createContext<Lang>("en");

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

export function useT(): TFn {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}

/** Translated text for components that render on both sides (server pages and client forms). */
export function Tx({ text, values }: { text: string; values?: TValues }) {
  return useT()(text, values);
}

/** formatPKR / formatDate / timeAgo in the page's language, for client components. */
export function useFormat() {
  const lang = useLang();
  return useMemo(
    () => ({
      formatPKR: (n: number) => formatPKR(n, lang),
      formatDate: (iso: string, withTime = false) => formatDate(iso, withTime, lang),
      timeAgo: (iso: string, now = Date.now()) => timeAgo(iso, now, lang),
    }),
    [lang],
  );
}
