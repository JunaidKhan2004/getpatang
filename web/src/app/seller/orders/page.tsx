import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from "@/lib/market";
import type { SellerOrderSummary } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Orders" };

const TABS: (OrderStatus | undefined)[] = [undefined, "PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"];

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await apiPage<SellerOrderSummary>("/seller/orders", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title="Orders" description="Confirm new orders quickly; customers see every status change." />
      <nav aria-label="Order status" className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/seller/orders?status=${s}` : "/seller/orders"}
            aria-current={(params.status ?? undefined) === s ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {s ? ORDER_STATUS_LABEL[s] : "All"} <span className="tabular-nums">({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})</span>
          </Link>
        ))}
      </nav>
      <form role="search" className="mb-4 flex max-w-md gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={params.q} placeholder="Order number or customer name" className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm" />
        <button className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">Search</button>
      </form>

      {!result && <Alert tone="error">Orders could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && <EmptyState title="No orders here" message="Orders appear here as soon as customers check out." />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/seller/orders/${o.orderNumber}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
                      <div className="text-xs text-muted">{formatDate(o.createdAt, true)} · {o.itemCount} items</div>
                    </td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="px-4 py-3"><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                    <td className="px-4 py-3 text-muted">{o.paymentMethod === "cod" ? "Cash on delivery" : "Bank transfer"} · {o.paymentStatus.toLowerCase()}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPKR(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/seller/orders" params={{ status: params.status, q: params.q }} />
        </>
      )}
    </>
  );
}
