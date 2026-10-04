"use client";

import { Languages } from "lucide-react";
import { useTransition } from "react";

import { setLanguageAction } from "@/app/actions/locale";
import { useLang } from "@/lib/i18n/client";

/** Switches between English and Urdu. Shows the other language in its own script. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const next = lang === "ur" ? "en" : "ur";
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      lang={next}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLanguageAction(next);
          window.location.reload();
        })
      }
      className={`inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-60 ${className}`}
      aria-label={next === "ur" ? "اردو میں دیکھیں" : "View in English"}
    >
      <Languages className="size-4" aria-hidden="true" />
      <span className={next === "ur" ? "font-[family-name:var(--font-nastaliq)]" : ""}>{next === "ur" ? "اردو" : "English"}</span>
    </button>
  );
}
