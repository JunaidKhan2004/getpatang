"use client";

import { Languages } from "lucide-react";
import { useTransition } from "react";

import { setLanguageAction } from "@/app/actions/locale";
import { useLang } from "@/lib/i18n/client";

/**
 * Switches between English and Urdu, naming the other language in its own script.
 * `className` must include the display (e.g. "inline-flex" or "hidden sm:inline-flex").
 * `compact` shows only the icon until the xl breakpoint, where the header has room for the name.
 */
export function LanguageSwitch({ className = "inline-flex", compact = false }: { className?: string; compact?: boolean }) {
  const lang = useLang();
  const next = lang === "ur" ? "en" : "ur";
  const name = next === "ur" ? "اردو" : "English";
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      lang={next}
      title={name}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLanguageAction(next);
          window.location.reload();
        })
      }
      className={`h-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-60 ${compact ? "min-w-10 xl:px-2.5" : "px-2.5"} ${className}`}
      aria-label={next === "ur" ? "اردو میں دیکھیں" : "View in English"}
    >
      <Languages className="size-5 shrink-0" aria-hidden="true" />
      <span className={`${compact ? "hidden xl:inline" : ""} ${next === "ur" ? "font-[family-name:var(--font-nastaliq)]" : ""}`}>{name}</span>
    </button>
  );
}
