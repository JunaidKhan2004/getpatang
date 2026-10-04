"use client";

import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * Home page hero: a dusk sky in the brand maroons with one large kite flying on the right,
 * smaller kites drifting at different depths, a mouse parallax and a staggered text reveal.
 * Everything is CSS/SVG (no libraries) and holds still for people who prefer reduced motion.
 */

/** Background kites: position (% of hero), size (px), depth (0 far → 1 near), float timing. */
const SKY = [
  { x: 6, y: 16, size: 30, depth: 0.25, dur: 11, delay: -2, tilt: -10 },
  { x: 22, y: 70, size: 22, depth: 0.15, dur: 13, delay: -6, tilt: 8 },
  { x: 44, y: 10, size: 18, depth: 0.1, dur: 14, delay: -1, tilt: -4 },
  { x: 58, y: 78, size: 26, depth: 0.2, dur: 12, delay: -8, tilt: 12 },
  { x: 92, y: 12, size: 34, depth: 0.35, dur: 10, delay: -4, tilt: 6 },
  { x: 86, y: 84, size: 20, depth: 0.12, dur: 15, delay: -9, tilt: -12 },
];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}

/** Counts up to `value` once, for the live numbers under the buttons. */
function CountUp({ value }: { value: number }) {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1400);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <span className="tabular-nums">{(reduce ? value : shown).toLocaleString("en-PK")}</span>;
}

function SmallKite({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 40 64" aria-hidden="true">
      <path d="M20 2 37 20 20 38 3 20Z" fill="#ffffff" fillOpacity=".9" />
      <path d="M20 2 37 20H20Z" fill="#f2e4e4" />
      <path d="M20 38c-4 6 4 10 0 16s4 8 0 10" fill="none" stroke="#ffffff" strokeOpacity=".7" strokeWidth="1.2" />
    </svg>
  );
}

/** The large flying patang, with its string (dor) and a tail that ripples in the wind. */
function HeroKite({ animate }: { animate: boolean }) {
  const tails = [
    "M130 250 C150 280 110 300 130 330 S110 380 130 410",
    "M130 250 C110 280 150 305 128 335 S152 380 126 412",
    "M130 250 C152 282 108 296 132 328 S108 384 132 408",
  ];
  return (
    <svg viewBox="0 0 260 420" className="h-auto w-full overflow-visible" aria-hidden="true">
      <g className={animate ? "hero-kite-fly" : undefined}>
        {/* Dor: runs down to someone on the ground, beyond the hero's edge */}
        <path d="M130 140 Q 20 420 -420 760" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="1.4" />
        {/* Body: classic patang halves in the client palette */}
        <path d="M130 10 240 130 130 250 20 130Z" fill="#f6f6f6" />
        <path d="M130 10 240 130 130 250Z" fill="#9b3b3b" />
        <path d="M130 10 240 130H130Z" fill="#6b1a1a" />
        <path d="M20 130H130V250Z" fill="#eae9e9" />
        <circle cx="130" cy="130" r="18" fill="#420000" />
        <circle cx="130" cy="130" r="7" fill="#f6f6f6" />
        {/* Spars (kaanp and dhadda) */}
        <path d="M130 10V250" stroke="#2a0000" strokeOpacity=".35" strokeWidth="2.5" />
        <path d="M24 128Q130 96 236 128" fill="none" stroke="#2a0000" strokeOpacity=".35" strokeWidth="2.5" />
        {/* Tail with bows */}
        <path d={tails[0]} fill="none" stroke="#f2e4e4" strokeWidth="2.5" strokeLinecap="round">
          {animate && <animate attributeName="d" dur="2.6s" repeatCount="indefinite" values={[...tails, tails[0]].join(";")} />}
        </path>
        {[300, 350, 400].map((y, i) => (
          <g key={y} className={animate ? "hero-bow" : undefined} style={{ animationDelay: `${-i * 0.4}s` }}>
            <path d={`M130 ${y} l-12 -7 v14Z M130 ${y} l12 -7 v14Z`} fill="#f2e4e4" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export interface HeroStats {
  shops?: number;
  products?: number;
  tournaments?: number;
}

export function HomeHero({ stats }: { stats: HeroStats }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();

  // Mouse parallax: near kites move more than far ones. Pointer devices only.
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || !window.matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        el.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce]);

  const liveStats = [
    { n: stats.shops, label: "verified shops" },
    { n: stats.products, label: "kites & supplies" },
    { n: stats.tournaments, label: "upcoming tournaments" },
  ].filter((s): s is { n: number; label: string } => typeof s.n === "number" && s.n > 0);

  return (
    <section ref={ref} className="hero-sky relative isolate overflow-hidden bg-maroon-950 text-white">
      {/* Breathing glow and the faint kite pattern */}
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute -top-1/3 end-[-10%] -z-10 h-[140%] w-[70%] rounded-full" />
      <div aria-hidden="true" className="kite-pattern pointer-events-none absolute inset-0 -z-10" />

      {/* Distant kites */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {SKY.map((k, i) => (
          <div
            key={i}
            className="hero-parallax absolute"
            style={{ insetInlineStart: `${k.x}%`, top: `${k.y}%`, ["--depth" as string]: k.depth, opacity: 0.15 + k.depth * 0.9, filter: k.depth < 0.15 ? "blur(1px)" : undefined }}
          >
            <div className="hero-drift" style={{ animationDuration: `${k.dur}s`, animationDelay: `${k.delay}s`, rotate: `${k.tilt}deg` }}>
              <SmallKite size={k.size} />
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-6">
          <p className="hero-reveal text-sm font-semibold tracking-[0.1em] text-maroon-100 uppercase" style={{ ["--d" as string]: "0ms" }}>
            {t("Pakistan’s kite platform")}</p>
          <h1 className="hero-reveal max-w-2xl text-4xl leading-tight font-bold sm:text-5xl" style={{ ["--d" as string]: "120ms" }}>
            {t("Kite shops, organised tournaments and")}{" "}<span className="hero-underline">{t("the people who fly.")}</span>
          </h1>
          <p className="hero-reveal max-w-xl text-lg text-maroon-100" style={{ ["--d" as string]: "240ms" }}>
            {t("Buy from trusted sellers, register for approved competitions and follow official rankings, all in one place.")}</p>
          <div className="hero-reveal flex flex-wrap gap-3" style={{ ["--d" as string]: "360ms" }}>
            <ButtonLink href="/marketplace" size="lg" className="!bg-white !text-maroon-900 shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5 hover:!bg-maroon-100">
              {t("Browse the marketplace")}</ButtonLink>
            <ButtonLink href="/tournaments" size="lg" variant="secondary" className="!border-white/40 !bg-white/5 !text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:!bg-white/10">
              {t("See tournaments")}</ButtonLink>
          </div>
          {liveStats.length > 0 && (
            <dl className="hero-reveal mt-2 flex flex-wrap gap-x-8 gap-y-3" style={{ ["--d" as string]: "480ms" }}>
              {liveStats.map((s) => (
                <div key={s.label} className="grid">
                  <dt className="order-2 text-sm text-maroon-100">{s.label}</dt>
                  <dd className="font-display text-3xl font-bold">
                    <CountUp value={s.n} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="hero-parallax relative hidden w-full max-w-sm justify-self-center lg:block" style={{ ["--depth" as string]: 1 }}>
          <div className="hero-reveal" style={{ ["--d" as string]: "200ms" }}>
            <HeroKite animate={!reduce} />
          </div>
        </div>
      </div>
    </section>
  );
}
