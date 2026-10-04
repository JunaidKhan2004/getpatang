import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { DailyBarChart } from "@/components/seller/bar-chart";
import { RangeSwitch, Stat } from "@/components/seller/stat";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/market";
import type { Dashboard } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Dashboard") };
}

export default async function SellerDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const tr = await getT();
  const days = ["7", "30", "90"].includes((await searchParams).days ?? "") ? Number((await searchParams).days) : 30;
  const d = await api<Dashboard>("/seller/dashboard", { token: await getAccessToken(), query: { days } }).catch(() => null);
  if (!d) return <Alert tone="error">{tr("Your dashboard could not load. Please refresh the page.")}</Alert>;
  const t = d.totals;

  return (
    <>
      <PageHeader
        title={tr("Dashboard")}
        description={tr("Your shop over the last {days} days.", { days })}
        actions={<div className="flex flex-wrap gap-2"><RangeSwitch days={days} basePath="/seller" /><ButtonLink href="/seller/products/new">{tr("Add product")}</ButtonLink></div>}
      />

      {t.pendingOrders > 0 && (
        <div className="mb-4">
          <Alert>
            {tr("You have")}{" "}<strong>{t.pendingOrders}</strong> {" "}{tr("new")}{" "}{t.pendingOrders === 1 ? "order" : "orders"} {" "}{tr("waiting for confirmation.{value}", { value: " " })}
            <Link href="/seller/orders?status=PENDING" className="font-semibold text-primary underline">{tr("Review now")}</Link>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Sales")} value={formatPKR(t.periodRevenue)} sub={tr("{orders} orders", { orders: t.periodOrders })} />
        <Stat label={tr("Average order")} value={formatPKR(t.averageOrderValue)} sub={tr("{customers} customers", { customers: t.periodCustomers })} />
        <Stat label={tr("New orders")} value={String(t.pendingOrders)} sub={tr("Waiting for you")} href="/seller/orders?status=PENDING" />
        <Stat label={tr("Live products")} value={String(t.liveProducts)} sub={tr("{customers} customers all-time", { customers: t.customers })} href="/seller/products?status=ACTIVE" />
      </div>

      <section aria-labelledby="rev" className="mt-6 rounded-md border border-border bg-surface p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rev" className="font-display font-semibold">{tr("Sales per day")}</h2>
          <span className="text-sm text-muted">{tr("Delivered all-time: {deliveredRevenue} from {deliveredOrders} orders", { deliveredRevenue: formatPKR(t.deliveredRevenue), deliveredOrders: t.deliveredOrders })}</span>
        </div>
        {t.periodOrders === 0 ? (
          <p className="py-10 text-center text-muted">{tr("No orders in this period yet.")}</p>
        ) : (
          <DailyBarChart points={d.series.map((s) => ({ date: s.date, value: s.revenue }))} label={tr("Sales")} kind="currency" />
        )}
        <p className="mt-2 text-xs text-muted">{tr("Counts every order that was not cancelled, returned or refunded.")}</p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="top" className="rounded-md border border-border bg-surface p-5">
          <h2 id="top" className="mb-3 font-display font-semibold">{tr("Best sellers")}</h2>
          {d.topProducts.length === 0 ? (
            <p className="text-sm text-muted">{tr("Your best-selling products will appear here.")}</p>
          ) : (
            <ol className="grid gap-2 text-sm">
              {d.topProducts.map((p, i) => (
                <li key={p.id ?? i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate"><span className="me-2 text-muted tabular-nums">{i + 1}.</span>{p.title ?? tr("Deleted product")}</span>
                  <span className="shrink-0 tabular-nums text-muted">{tr("{unitsSold} sold ·", { unitsSold: p.unitsSold })}{" "}<span className="text-ink">{formatPKR(p.revenue)}</span></span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="low" className="rounded-md border border-border bg-surface p-5">
          <h2 id="low" className="mb-3 flex items-center gap-2 font-display font-semibold">
            {d.lowStock.length > 0 && <AlertTriangle className="size-4 text-warning" aria-hidden="true" />} {" "}{tr("Low stock")}</h2>
          {d.lowStock.length === 0 ? (
            <p className="text-sm text-muted">{tr("All products are well stocked.")}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <Link href={`/seller/products/${p.id}`} className="min-w-0 truncate hover:text-primary">{p.title}</Link>
                  <span className="shrink-0 text-warning tabular-nums">{p.lowOptions.length ? p.lowOptions.join(", ") : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="recent" className="mt-6 rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="recent" className="font-display font-semibold">{tr("Recent orders")}</h2>
          <Link href="/seller/orders" className="text-sm font-semibold text-primary hover:underline">{tr("All orders")}</Link>
        </div>
        {d.recentOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">{tr("No orders yet. Share your shop link to get your first order.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {d.recentOrders.map((o) => (
              <li key={o.orderNumber}>
                <Link href={`/seller/orders/${o.orderNumber}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-surface-2">
                  <span className="font-medium">{o.orderNumber} <span className="font-normal text-muted">· {o.customerName} · {formatDate(o.createdAt)}</span></span>
                  <span className="flex items-center gap-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{tr(ORDER_STATUS_LABEL[o.status])}</Badge><span className="tabular-nums">{formatPKR(o.total)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
