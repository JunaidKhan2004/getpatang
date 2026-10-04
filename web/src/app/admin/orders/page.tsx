import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import type { AdminOrderRow } from "@/lib/admin";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Orders") };
}

const TABS: (OrderStatus | undefined)[] = [undefined, "PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const result = await apiPage<AdminOrderRow>("/admin/orders", { token: await getAccessToken(), query: { ...params, pageSize: 25 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title={t("Orders")} description={t("Every order across all shops. Open one to see its payment, timeline and refunds.")} />
      <nav aria-label={t("Status")} className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/orders?status=${s}` : "/admin/orders"}
            aria-current={params.status === s ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {s ? t(ORDER_STATUS_LABEL[s]) : t("All")} ({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})
          </Link>
        ))}
      </nav>
      <form role="search" className="mb-4 flex gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <label htmlFor="oq" className="sr-only">{t("Search orders")}</label>
        <input id="oq" name="q" defaultValue={params.q} placeholder={t("Order number, customer name, email or phone")} className="h-10 w-80 rounded-md border border-border bg-surface px-3 text-sm" />
      </form>

      {!result && <Alert tone="error">{t("Orders could not load. You may not have permission to manage orders.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("No orders here")} message={t("Try another status or search.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("Order")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Customer")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Shop")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Status")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Payment")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
                      <div className="text-xs text-muted">{t("{true} · {itemCount} item", { true: formatDate(o.createdAt, true), itemCount: o.itemCount })}{o.itemCount === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-4 py-3"><div>{o.user.fullName}</div><div className="text-xs text-muted">{o.user.email}</div></td>
                    <td className="px-4 py-3">{o.shop.name}</td>
                    <td className="px-4 py-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_LABEL[o.status])}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{t(PAYMENT_STATUS_LABEL[o.paymentStatus])}</Badge><div className="text-xs text-muted">{o.paymentLabel}</div></td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatPKR(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/admin/orders" params={{ status: params.status, q: params.q }} />
        </>
      )}
    </>
  );
}
