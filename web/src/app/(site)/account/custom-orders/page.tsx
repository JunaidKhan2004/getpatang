import type { Metadata } from "next";
import Link from "next/link";

import { KitePreview } from "@/components/designer/kite-preview";
import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { CUSTOM_STATUS_LABEL, CUSTOM_STATUS_TONE, type CustomOrder } from "@/lib/designer";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Custom orders" };

export default async function CustomOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser("/account/custom-orders");
  const params = await searchParams;
  const result = await apiPage<CustomOrder>("/custom-orders", { token: await getAccessToken(), query: { ...params, pageSize: 10 } }).catch(() => null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/account" className="hover:text-primary">Account</Link> / Custom orders</nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Custom orders</h1>
        <ButtonLink href="/account/designs" variant="secondary">My designs</ButtonLink>
      </div>
      {!result && <Alert tone="error">Your requests could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title="No requests yet" message="Design a kite, then ask a shop to make it." action={<ButtonLink href="/designer">Open the designer</ButtonLink>} />
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="grid gap-3">
            {result.data.map((r) => (
              <li key={r.id}>
                <Link href={`/account/custom-orders/${r.id}`} className="flex items-center gap-4 rounded-md border border-border bg-surface p-4 hover:border-primary">
                  <KitePreview design={r.design} className="h-20 w-16 shrink-0" title={r.designName} />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-semibold">{r.designName}</span>
                      <Badge tone={r.quoteExpired ? "neutral" : CUSTOM_STATUS_TONE[r.status]}>{r.quoteExpired ? "Quote expired" : CUSTOM_STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted">{r.shop.name} · {r.quantity} pcs · {r.number} · {formatDate(r.createdAt)}</p>
                  </div>
                  {r.quote && <span className="font-semibold tabular-nums">{formatPKR(r.quote.price)}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} basePath="/account/custom-orders" params={{}} />
        </>
      )}
    </div>
  );
}
