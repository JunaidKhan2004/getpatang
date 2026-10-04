"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

interface Point {
  date: string;
  value: number;
}

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= v / 4)! * pow;
  return Math.ceil(v / step) * step;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Single-series daily bar chart. One hue (the brand primary), thin rounded bars with a 2px gap,
 * recessive grid, hover/focus tooltip per bar, and a screen-reader table of the same data.
 */
const FORMATS = {
  currency: (n: number) => (n >= 1000 ? `Rs ${Math.round(n / 100) / 10}k` : `Rs ${n}`),
  count: (n: number) => String(Math.round(n)),
};

export function DailyBarChart({ points, label, kind }: { points: Point[]; label: string; kind: keyof typeof FORMATS }) {
  const tr = useT();
  const format = FORMATS[kind];
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / points.length;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(points.length / 7);
  const a = active !== null ? points[active] : null;

  return (
    <figure className="grid gap-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tr("{label} per day", { label })} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const h = Math.max(p.value > 0 ? 2 : 0, innerH - (y(p.value) - PAD.top));
            const r = Math.min(4, barW / 2, h);
            const top = PAD.top + innerH - h;
            return (
              <g key={p.date}>
                {h > 0 && (
                  <path
                    d={`M${x},${PAD.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + innerH} Z`}
                    fill="var(--primary)"
                    opacity={active === null || active === i ? 1 : 0.45}
                  />
                )}
                {/* Hit target wider and taller than the bar */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${shortDate(p.date)}: ${format(p.value)}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
                {i % labelEvery === 0 && (
                  <text x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {shortDate(p.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {a && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-md"
            style={{ left: `clamp(0px, calc(${((PAD.left + (active! + 0.5) * slot) / W) * 100}% - 70px), calc(100% - 140px))` }}
          >
            <div className="text-xs text-muted">{shortDate(a.date)}</div>
            <div className="font-semibold tabular-nums">{format(a.value)}</div>
          </div>
        )}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{tr("{label} per day", { label })}</caption>
          <thead><tr><th>{tr("Date")}</th><th>{label}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.date}><td>{p.date}</td><td>{format(p.value)}</td></tr>)}</tbody>
        </table>
      </figcaption>
    </figure>
  );
}
