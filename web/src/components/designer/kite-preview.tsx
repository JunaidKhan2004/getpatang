"use client";

import { useId } from "react";

import { bodyPoints, type KiteDesign, STAR_POINTS, starPath, tailAnchor, tailPath, textSize } from "@/lib/designer";

const FONT_FAMILY = { sans: "var(--font-inter), Inter, sans-serif", display: "var(--font-poppins), Poppins, sans-serif", serif: "Georgia, 'Times New Roman', serif" } as const;

/** Live SVG drawing of a design. Same rules as the mobile painter. */
export function KitePreview({ design, className = "", title }: { design: KiteDesign; className?: string; title?: string }) {
  const clip = `kite-${useId().replace(/:/g, "")}`;
  const pts = bodyPoints(design.shape, design.size);
  const poly = pts.map((p) => p.join(",")).join(" ");
  const top = pts[0];
  const bottom = tailAnchor(design.shape, design.size);
  const left = pts.reduce((a, b) => (b[0] < a[0] ? b : a));
  const right = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
  const tail = design.tail ? tailPath(bottom) : null;
  const text = design.text?.trim() ?? "";
  const hasImage = Boolean(design.imageUrl);
  const pc = design.patternColor;

  return (
    <svg viewBox="0 0 200 260" role="img" aria-label={title ?? "Kite design preview"} className={className}>
      <defs>
        <clipPath id={clip}><polygon points={poly} /></clipPath>
      </defs>

      {tail && (
        <g stroke={design.tailColor} fill={design.tailColor}>
          <path d={tail.line} fill="none" strokeWidth={2.5} strokeLinecap="round" />
          {tail.bows.map(([x, y]) => (
            <path key={y} d={`M ${x} ${y} l -9 -5 l 0 10 Z M ${x} ${y} l 9 -5 l 0 10 Z`} strokeWidth={1} />
          ))}
        </g>
      )}

      <polygon points={poly} fill={design.background} />
      <g clipPath={`url(#${clip})`}>
        {design.pattern === "stripes" && Array.from({ length: 9 }, (_, k) => <rect key={k} x={0} y={k * 24} width={200} height={12} fill={pc} />)}
        {design.pattern === "checks" &&
          Array.from({ length: 64 }, (_, i) => [i % 8, Math.floor(i / 8)] as const)
            .filter(([c, r]) => (c + r) % 2 === 0)
            .map(([c, r]) => <rect key={`${c}-${r}`} x={c * 25} y={r * 25} width={25} height={25} fill={pc} />)}
        {design.pattern === "halves" && <rect x={100} y={0} width={100} height={200} fill={pc} />}
        {design.pattern === "quarters" && (
          <>
            <rect x={0} y={0} width={100} height={100} fill={pc} />
            <rect x={100} y={100} width={100} height={100} fill={pc} />
          </>
        )}
        {design.pattern === "border" && <polygon points={poly} fill="none" stroke={pc} strokeWidth={16} />}
        {design.pattern === "stars" && STAR_POINTS.map((p) => <path key={p.join()} d={starPath(p)} fill={pc} />)}

        {hasImage && (
          <>
            <clipPath id={`${clip}-img`}><circle cx={100} cy={text ? 88 : 100} r={30} /></clipPath>
            <image href={design.imageUrl!} x={70} y={text ? 58 : 70} width={60} height={60} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip}-img)`} />
          </>
        )}
      </g>

      {/* Spars */}
      <g stroke="#000" strokeOpacity={0.22} strokeWidth={1.5}>
        <line x1={top[0]} y1={top[1]} x2={bottom[0]} y2={bottom[1]} />
        <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} />
      </g>
      <polygon points={poly} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={1.5} />

      {text && (
        <text
          x={100}
          y={hasImage ? 136 : 106}
          textAnchor="middle"
          fill={design.textColor}
          fontSize={textSize(text)}
          fontWeight={design.font === "display" ? 700 : 500}
          fontFamily={FONT_FAMILY[design.font]}
        >
          {text}
        </text>
      )}
    </svg>
  );
}
