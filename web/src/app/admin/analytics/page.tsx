import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { DailyBarChart } from "@/components/seller/bar-chart";
import { Alert, EmptyState } from "@/components/ui/feedback";
import type { Analytics } from "@/lib/admin";
import { api } from "@/lib/api";
import { formatPKR, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Analytics") };
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const t = await getT();
  const requested = Number((await searchParams).days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const a = await api<Analytics>("/admin/analytics", { token: await getAccessToken(), query: { days } }).catch(() => null);

  return (
    <>
      <PageHeader
        title={t("Analytics")}
        description={t("Recorded platform activity. Order value excludes cancelled orders.")}
        actions={
          <nav aria-label={t("Range")} className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/admin/analytics?days=${d}`} aria-current={d === days ? "page" : undefined} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                {t("{d} days", { d })}</Link>
            ))}
          </nav>
        }
      />
      {!a && <Alert tone="error">{t("Analytics could not load. You may not have permission to view them.")}</Alert>}
      {a && (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t("Orders placed"), value: a.totals.orders.toLocaleString("en-PK") },
              { label: t("Order value"), value: formatPKR(a.totals.grossOrderValue) },
              { label: t("Delivered value"), value: formatPKR(a.totals.deliveredValue), hint: `${a.totals.deliveredOrders} orders` },
              { label: t("New members"), value: a.totals.newUsers.toLocaleString("en-PK"), hint: `${a.totals.users.toLocaleString("en-PK")} in total` },
              { label: t("Approved shops"), value: a.totals.shops.toLocaleString("en-PK") },
              { label: t("Live products"), value: a.totals.liveProducts.toLocaleString("en-PK") },
              { label: t("Community posts"), value: a.totals.posts.toLocaleString("en-PK") },
              { label: t("Upcoming events"), value: a.totals.upcomingEvents.toLocaleString("en-PK") },
            ].map((s) => (
              <div key={s.label} className="grid gap-1 rounded-md border border-border bg-surface p-5">
                <span className="text-sm font-medium text-muted">{s.label}</span>
                <span className="font-display text-2xl font-bold tabular-nums">{s.value}</span>
                {s.hint && <span className="text-xs text-muted">{s.hint}</span>}
              </div>
            ))}
          </div>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-5">
              <h2 className="mb-3 font-display font-semibold">{t("Order value per day")}</h2>
              <DailyBarChart points={a.daily.map((d) => ({ date: d.date, value: d.revenue }))} label={t("Order value per day")} kind="currency" />
            </div>
            <div className="rounded-md border border-border bg-surface p-5">
              <h2 className="mb-3 font-display font-semibold">{t("New members per day")}</h2>
              <DailyBarChart points={a.daily.map((d) => ({ date: d.date, value: d.signups }))} label={t("New members per day")} kind="count" />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-5">
              <h2 className="mb-3 font-display font-semibold">{t("Top shops by order value")}</h2>
              {a.topShops.length === 0 ? (
                <EmptyState title={t("No orders yet")} message={t("Shops appear here once they receive orders.")} />
              ) : (
                <ol className="grid gap-2 text-sm">
                  {a.topShops.map((s, i) => (
                    <li key={s.id ?? i} className="flex justify-between gap-3">
                      <span>{i + 1}. {s.id ? <Link href={`/admin/sellers/${s.id}`} className="text-primary hover:underline">{s.name}</Link> : t("Removed shop")} <span className="text-muted">{t("· {orders} orders", { orders: s.orders })}</span></span>
                      <span className="tabular-nums">{formatPKR(s.value)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="rounded-md border border-border bg-surface p-5">
              <h2 className="mb-3 font-display font-semibold">{t("Orders by status")}</h2>
              {Object.keys(a.ordersByStatus).length === 0 ? (
                <p className="text-sm text-muted">{t("No orders in this period.")}</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {Object.entries(a.ordersByStatus).map(([s, n]) => (
                    <li key={s} className="flex justify-between"><Link href={`/admin/orders?status=${s}`} className="hover:text-primary">{t(ORDER_STATUS_LABEL[s as OrderStatus])}</Link><span className="tabular-nums">{n}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
