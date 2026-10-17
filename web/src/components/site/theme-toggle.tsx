"use client";

import { Moon, Sun, SunMoon } from "lucide-react";

import { useTheme } from "@/lib/theme";

const ICONS = {
  light: Sun,
  dark: Moon,
  system: SunMoon,
} as const;

const LABELS = {
  light: "Light mode — click for dark",
  dark: "Dark mode — click for system",
  system: "System theme — click for light",
} as const;

/**
 * Three-way toggle: light → dark → system → light.
 * Pass `className` for display control (same API as LanguageSwitch).
 */
export function ThemeToggle({
  className = "inline-flex",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { mode, toggle } = useTheme();
  const Icon = ICONS[mode];

  return (
    <button
      id="theme-toggle"
      type="button"
      title={LABELS[mode]}
      aria-label={LABELS[mode]}
      onClick={toggle}
      className={`h-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-semibold text-ink transition-colors hover:bg-surface-2 ${compact ? "min-w-10 xl:px-2.5" : "px-2.5"} ${className}`}
    >
      <Icon
        className="size-5 shrink-0 transition-transform duration-300"
        aria-hidden="true"
      />
      {!compact && (
        <span className="hidden xl:inline capitalize">{mode}</span>
      )}
    </button>
  );
}
