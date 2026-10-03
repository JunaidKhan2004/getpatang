import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import type { AdminOrderRow } from "@/lib/admin";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Orders" };

const TABS: (OrderStatus | undefined)[] = [undefined, "PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await apiPage<AdminOrderRow>("/admin/orders", { token: await getAccessToken(), query: { ...params, pageSize: 25 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title="Orders" description="Every order across all shops. Open one to see its payment, timeline and refunds." />
      <nav aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/orders?status=${s}` : "/admin/orders"}
            aria-current={params.status === s ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {s ? ORDER_STATUS_LABEL[s] : "All"} ({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})
          </Link>
        ))}
      </nav>
      <form role="search" className="mb-4 flex gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={params.q} placeholder="Order number, customer name, email or phone" className="h-10 w-80 rounded-md border border-border bg-surface px-3 text-sm" />
      </form>

      {!result && <Alert tone="error">Orders could not load. You may not have permission to manage orders.</Alert>}
      {result && result.data.length === 0 && <EmptyState title="No orders here" message="Try another status or search." />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Shop</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
                      <div className="text-xs text-muted">{formatDate(o.createdAt, true)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-4 py-3"><div>{o.user.fullName}</div><div className="text-xs text-muted">{o.user.email}</div></td>
                    <td className="px-4 py-3">{o.shop.name}</td>
                    <td className="px-4 py-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge><div className="text-xs text-muted">{o.paymentLabel}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPKR(o.total)}</td>
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
