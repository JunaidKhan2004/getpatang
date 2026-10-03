/** Kite-diamond brand mark. Colours default to the current text colour family. */
export function KiteMark({
  size = 32,
  body = "var(--primary)",
  wing = "var(--highlight)",
  className,
}: {
  size?: number;
  body?: string;
  wing?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" aria-hidden="true" className={className}>
      <path d="M50 4 92 50 50 116 8 50Z" fill={body} />
      <path d="M50 4 92 50H50Z" fill={wing} />
      <path d="M8 50H50v66Z" fill={wing} opacity=".8" />
      <path d="M50 4v112M8 50h84" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KiteMark
        size={24}
        body={inverted ? "#ffffff" : "var(--primary)"}
        wing={inverted ? "#f2e4e4" : "var(--highlight)"}
      />
      <span className={`font-display text-lg font-semibold ${inverted ? "text-white" : "text-ink"}`}>
        Kite Platform
      </span>
    </span>
  );
}
