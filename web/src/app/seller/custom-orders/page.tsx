import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { CustomStatusBadge } from "@/components/designer/custom-order-view";
import { KitePreview } from "@/components/designer/kite-preview";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { CUSTOM_STATUS_LABEL, type CustomOrder, type CustomOrderStatus } from "@/lib/designer";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Custom orders" };

const TABS: (CustomOrderStatus | undefined)[] = [undefined, "REQUESTED", "CLARIFICATION_NEEDED", "QUOTED", "ACCEPTED", "REJECTED", "DECLINED", "CANCELLED"];
const SHORT: Partial<Record<CustomOrderStatus, string>> = { REQUESTED: "New", CLARIFICATION_NEEDED: "Awaiting reply", QUOTED: "Quoted", ACCEPTED: "Accepted", REJECTED: "Declined by you", DECLINED: "Quote declined" };

export default async function SellerCustomOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await apiPage<CustomOrder>("/seller/custom-orders", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title="Custom orders" description="Design requests from customers. Ask questions, send a quote, and an order is created when they accept." />
      {!result && <Alert tone="error">Requests could not load. Please refresh the page.</Alert>}
      {result && (
        <>
          <nav aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map((s) => (
              <Link key={s ?? "all"} href={s ? `/seller/custom-orders?status=${s}` : "/seller/custom-orders"} aria-current={params.status === s ? "page" : undefined} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                {s ? (SHORT[s] ?? CUSTOM_STATUS_LABEL[s]) : "All"} ({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})
              </Link>
            ))}
          </nav>
          {result.data.length === 0 ? (
            <EmptyState title="No requests here" message="When customers send a design to your shop, it appears here. You can turn custom orders off in Shop settings." />
          ) : (
            <>
              <ul className="grid gap-3">
                {result.data.map((r) => (
                  <li key={r.id}>
                    <Link href={`/seller/custom-orders/${r.id}`} className="flex items-center gap-4 rounded-md border border-border bg-surface p-4 hover:border-primary">
                      <KitePreview design={r.design} className="h-20 w-16 shrink-0" title={r.designName} />
                      <div className="grid min-w-0 flex-1 gap-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-display font-semibold">{r.designName}</span><CustomStatusBadge r={r} /></div>
                        <p className="text-sm text-muted">{r.customer.name} · {r.quantity} pcs{r.budget ? ` · budget ${formatPKR(r.budget)}` : ""}{r.deadline ? ` · by ${formatDate(r.deadline)}` : ""}</p>
                        <p className="text-xs text-muted">{r.number} · updated {formatDate(r.updatedAt, true)}</p>
                      </div>
                      {r.quote && <span className="font-semibold tabular-nums">{formatPKR(r.quote.price)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination meta={result.meta} basePath="/seller/custom-orders" params={{ status: params.status }} />
            </>
          )}
        </>
      )}
    </>
  );
}
