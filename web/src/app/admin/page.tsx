import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/feedback";
import type { Analytics, Queues } from "@/lib/admin";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Dashboard") };
}

const QUEUE_TILES: { key: keyof Queues; label: string; href: string }[] = [
  { key: "sellerApplications", label: "Seller applications waiting", href: "/admin/sellers?status=PENDING" },
  { key: "productsPending", label: "Products waiting for approval", href: "/admin/products" },
  { key: "paymentsToVerify", label: "Bank transfers to verify", href: "/admin/payments" },
  { key: "refundsToSend", label: "Refunds to send", href: "/admin/payments?view=refunds" },
  { key: "openReports", label: "Reported items to review", href: "/admin/reports" },
  { key: "disputes", label: "Disputed matches", href: "/admin/matches" },
  { key: "activeTournaments", label: "Tournaments in progress", href: "/admin/tournaments?status=IN_PROGRESS" },
];

export default async function AdminDashboard() {
  const tr = await getT();
  const user = await requireUser("/admin");
  const token = await getAccessToken();
  const canSeeNumbers = user.permissions?.includes("orders.manage");
  const [queues, stats] = await Promise.all([
    api<Queues>("/admin/queues", { token }).catch(() => null),
    canSeeNumbers ? api<Analytics>("/admin/analytics", { token, query: { days: 30 } }).catch(() => null) : Promise.resolve(null),
  ]);
  const tile = "grid gap-1 rounded-md border border-border bg-surface p-5 hover:border-primary";
  const visible = QUEUE_TILES.filter((t) => queues && queues[t.key] !== null);

  return (
    <>
      <PageHeader title={tr("Dashboard")} description={tr("What needs attention, and how the platform is doing.")} />
      {!queues && <Alert tone="error">{tr("The dashboard could not load. Please refresh the page.")}</Alert>}
      {visible.length > 0 && (
        <section aria-labelledby="todo" className="mb-8">
          <h2 id="todo" className="mb-3 text-lg font-semibold">{tr("Waiting for you")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visible.map((t) => {
              const n = queues![t.key] ?? 0;
              return (
                <Link key={t.key} href={t.href} className={`${tile} ${n > 0 ? "border-primary/50" : ""}`}>
                  <span className="text-sm font-medium text-muted">{tr(t.label)}</span>
                  <span className={`font-display text-3xl font-bold tabular-nums ${n > 0 ? "text-primary" : ""}`}>{n}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {stats && (
        <section aria-labelledby="month">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="month" className="text-lg font-semibold">{tr("Last 30 days")}</h2>
            <Link href="/admin/analytics" className="text-sm font-semibold text-primary hover:underline">{tr("Analytics")}</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: tr("Orders placed"), value: stats.totals.orders.toLocaleString("en-PK") },
              { label: tr("Order value"), value: formatPKR(stats.totals.grossOrderValue) },
              { label: tr("New members"), value: stats.totals.newUsers.toLocaleString("en-PK") },
              { label: tr("Approved shops"), value: stats.totals.shops.toLocaleString("en-PK") },
            ].map((s) => (
              <div key={s.label} className="grid gap-1 rounded-md border border-border bg-surface p-5">
                <span className="text-sm font-medium text-muted">{s.label}</span>
                <span className="font-display text-3xl font-bold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
