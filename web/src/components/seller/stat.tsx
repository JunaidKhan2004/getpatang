import Link from "next/link";

export function Stat({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="font-display text-2xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </>
  );
  const cls = "grid content-start gap-1 rounded-md border border-border bg-surface p-4";
  return href ? <Link href={href} className={`${cls} hover:border-primary`}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** 7 / 30 / 90-day switch using plain links. */
export function RangeSwitch({ days, basePath }: { days: number; basePath: string }) {
  return (
    <nav aria-label="Time range" className="inline-flex rounded-md border border-border bg-surface p-1 text-sm">
      {[7, 30, 90].map((d) => (
        <Link
          key={d}
          href={`${basePath}?days=${d}`}
          aria-current={d === days ? "page" : undefined}
          className="rounded px-3 py-1.5 font-medium text-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-ink"
        >
          {d} days
        </Link>
      ))}
    </nav>
  );
}
