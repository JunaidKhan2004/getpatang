import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderSummary } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser("/account/orders");
  const { page } = await searchParams;
  const result = await apiPage<OrderSummary>("/orders", { token: await getAccessToken(), query: { page, pageSize: 10 } }).catch(() => null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/account" className="hover:text-primary">My account</Link> / Orders</nav>
      <h1 className="mb-6 text-3xl font-bold">My orders</h1>

      {!result && <Alert tone="error">We could not load your orders. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title="No orders yet" message="When you place an order it will appear here." action={<ButtonLink href="/marketplace">Start shopping</ButtonLink>} />
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="grid gap-3">
            {result.data.map((o) => (
              <li key={o.orderNumber}>
                <Link href={`/account/orders/${o.orderNumber}`} className="grid gap-2 rounded-md border border-border bg-surface p-4 hover:border-primary sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-semibold">{o.orderNumber}</span>
                      <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    </span>
                    <span className="text-sm text-muted">{o.shop.name} · {formatDate(o.createdAt)}</span>
                    <span className="truncate text-sm">
                      {o.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}
                      {o.itemCount > o.items.length && ` and ${o.itemCount - o.items.length} more`}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums">{formatPKR(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} basePath="/account/orders" params={{}} />
        </>
      )}
    </div>
  );
}
