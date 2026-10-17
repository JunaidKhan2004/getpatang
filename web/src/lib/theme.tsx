"use client";

/**
 * Theme provider — persists "light" | "dark" | "system" in localStorage and
 * applies data-theme="light" or data-theme="dark" on <html> so CSS can use it
 * independently of the OS preference.
 *
 * Usage:
 *   Wrap the app in <ThemeProvider> (inside RootLayout's <body>).
 *   Read / set the theme with useTheme().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeCtx {
  mode: ThemeMode;
  /** Whether dark colours are actually active right now (resolves "system"). */
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  /** Cycle: light → dark → system → light */
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: "system",
  isDark: false,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "gp-theme";
const CYCLE: ThemeMode[] = ["light", "dark", "system"];

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  // "system" — read OS preference
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement;
  const dark = resolveIsDark(mode);
  html.setAttribute("data-theme", dark ? "dark" : "light");
  html.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Use a ref so toggle() always reads the freshest mode without stale closure.
  const modeRef = useRef<ThemeMode>("system");
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [isDark, setIsDark] = useState(false);

  // Initialise from localStorage on first render (client only).
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "system";
    modeRef.current = saved;
    setModeState(saved);
    applyTheme(saved);
    setIsDark(resolveIsDark(saved));
  }, []);

  // React to OS preference changes when mode === "system".
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (modeRef.current === "system") {
        applyTheme("system");
        setIsDark(resolveIsDark("system"));
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []); // runs once; uses ref so no stale closure

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    modeRef.current = m;
    setModeState(m);
    applyTheme(m);
    setIsDark(resolveIsDark(m));
  }, []);

  const toggle = useCallback(() => {
    // Read fresh mode from ref — avoids stale closure bug
    const current = modeRef.current;
    const idx = CYCLE.indexOf(current);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  }, [setMode]);

  return <Ctx.Provider value={{ mode, isDark, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
