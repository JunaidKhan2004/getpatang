import type { ReactNode } from "react";

import { KiteMark } from "./kite-mark";

type Tone = "error" | "success" | "info";

const tones: Record<Tone, string> = {
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success",
  info: "border-primary/20 bg-primary-soft text-ink",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-16 text-center">
      <KiteMark size={44} />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "brand" }) {
  const map = {
    neutral: "bg-surface-2 text-muted",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
    info: "bg-info/12 text-info",
    brand: "bg-primary-soft text-primary",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}
