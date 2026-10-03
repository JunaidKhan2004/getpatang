import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, type OrderStatus, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, type PaymentStatus } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { CompleteRefund, ReviewPayment } from "./payment-actions";

export const metadata = { title: "Payments" };

interface PaymentRow {
  id: string;
  providerLabel: string;
  amount: number;
  status: PaymentStatus;
  reference: string | null;
  proofUploadId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  order: { orderNumber: string; status: OrderStatus; total: number; shop: string; customer: string; email: string };
}

interface RefundRow {
  id: string;
  amount: number;
  reason: string;
  status: "PENDING" | "COMPLETED";
  reference: string | null;
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
  order: { orderNumber: string; method: string; customer: string; email: string; phone: string | null };
}

const PAYMENT_TABS: (PaymentStatus | undefined)[] = ["VERIFYING", "PENDING", "PAID", "REFUNDED", "FAILED", undefined];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string; page?: string }> }) {
  const params = await searchParams;
  const token = await getAccessToken();
  const refundsView = params.view === "refunds";
  const status = params.status ?? (refundsView ? "PENDING" : "VERIFYING");
  const query = { status: status === "ALL" ? undefined : status, q: params.q, page: params.page, pageSize: 20 };
  const [payments, refunds] = await Promise.all([
    refundsView ? null : apiPage<PaymentRow>("/admin/payments", { token, query }).catch(() => null),
    refundsView ? apiPage<RefundRow>("/admin/refunds", { token, query }).catch(() => null) : null,
  ]);
  const counts = (payments?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};
  const tab = "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary";

  return (
    <>
      <PageHeader title="Payments" description="Verify bank transfers and record refunds. Cash on delivery is marked paid when the order is delivered." />
      <nav aria-label="Section" className="mb-3 flex gap-1 border-b border-border pb-3">
        <Link href="/admin/payments" aria-current={!refundsView ? "page" : undefined} className={tab}>Payments</Link>
        <Link href="/admin/payments?view=refunds" aria-current={refundsView ? "page" : undefined} className={tab}>Refunds</Link>
      </nav>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {refundsView && <input type="hidden" name="view" value="refunds" />}
        <input type="hidden" name="status" value={status} />
        <label htmlFor="pay-q" className="sr-only">Search</label>
        <input id="pay-q" name="q" defaultValue={params.q} placeholder="Order number or reference" className="h-10 w-64 rounded-md border border-border bg-surface px-3 text-sm" />
      </form>

      {!refundsView && (
        <>
          <nav aria-label="Status" className="mb-4 flex gap-1 overflow-x-auto">
            {PAYMENT_TABS.map((s) => (
              <Link key={s ?? "ALL"} href={`/admin/payments?status=${s ?? "ALL"}`} aria-current={status === (s ?? "ALL") ? "page" : undefined} className={tab}>
                {s ? PAYMENT_STATUS_LABEL[s] : "All"} ({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})
              </Link>
            ))}
          </nav>
          {!payments && <Alert tone="error">Payments could not load. You may not have permission to manage payments.</Alert>}
          {payments && payments.data.length === 0 && <EmptyState title="Nothing here" message={status === "VERIFYING" ? "No bank transfers are waiting to be checked." : "No payments with this status."} />}
          {payments && payments.data.length > 0 && (
            <>
              <ul className="grid gap-3">
                {payments.data.map((p) => (
                  <li key={p.id} className="grid gap-3 rounded-md border border-border bg-surface p-4 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold">{formatPKR(p.amount)}</span>
                        <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                        <span className="text-muted">{p.providerLabel}</span>
                      </div>
                      <p>
                        Order <span className="font-medium">{p.order.orderNumber}</span> ({ORDER_STATUS_LABEL[p.order.status]}) · {p.order.shop} · {p.order.customer}{" "}
                        <span className="text-muted">({p.order.email})</span>
                      </p>
                      {p.reference && <p>Reference: <span className="font-mono">{p.reference}</span>{p.submittedAt && <span className="text-muted"> · sent {formatDate(p.submittedAt, true)}</span>}</p>}
                      {p.proofUploadId && <a href={`/api/files/${p.proofUploadId}`} target="_blank" rel="noopener" className="w-fit font-medium text-primary hover:underline">Open receipt</a>}
                      {p.reviewedAt && (
                        <p className="text-muted">
                          Reviewed by {p.reviewedBy ?? "staff"} on {formatDate(p.reviewedAt, true)}{p.reviewNote ? `: ${p.reviewNote}` : ""}
                        </p>
                      )}
                    </div>
                    {(p.status === "VERIFYING" || (p.status === "PENDING" && p.providerLabel === "Bank transfer")) && p.order.status !== "CANCELLED" && (
                      <ReviewPayment id={p.id} canReject={p.status === "VERIFYING"} />
                    )}
                  </li>
                ))}
              </ul>
              <Pagination meta={payments.meta} basePath="/admin/payments" params={{ status, q: params.q }} />
            </>
          )}
        </>
      )}

      {refundsView && (
        <>
          <nav aria-label="Status" className="mb-4 flex gap-1">
            {[{ v: "PENDING", l: "To send" }, { v: "COMPLETED", l: "Sent" }, { v: "ALL", l: "All" }].map((s) => (
              <Link key={s.v} href={`/admin/payments?view=refunds&status=${s.v}`} aria-current={status === s.v ? "page" : undefined} className={tab}>{s.l}</Link>
            ))}
          </nav>
          {!refunds && <Alert tone="error">Refunds could not load. You may not have permission to manage payments.</Alert>}
          {refunds && refunds.data.length === 0 && <EmptyState title="No refunds here" message="Refunds appear when a paid order is cancelled or returned." />}
          {refunds && refunds.data.length > 0 && (
            <>
              <ul className="grid gap-3">
                {refunds.data.map((r) => (
                  <li key={r.id} className="grid gap-3 rounded-md border border-border bg-surface p-4 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold">{formatPKR(r.amount)}</span>
                        <Badge tone={r.status === "COMPLETED" ? "success" : "warning"}>{r.status === "COMPLETED" ? "Sent" : "To send"}</Badge>
                        <span className="text-muted">paid by {r.order.method}</span>
                      </div>
                      <p>Order <span className="font-medium">{r.order.orderNumber}</span> · {r.order.customer} <span className="text-muted">({[r.order.email, r.order.phone].filter(Boolean).join(", ")})</span></p>
                      <p className="text-muted">{r.reason} · opened {formatDate(r.createdAt, true)}</p>
                      {r.status === "COMPLETED" && <p>Sent by {r.processedBy ?? "staff"}{r.processedAt && ` on ${formatDate(r.processedAt, true)}`}, reference <span className="font-mono">{r.reference}</span></p>}
                    </div>
                    {r.status === "PENDING" && <CompleteRefund id={r.id} />}
                  </li>
                ))}
              </ul>
              <Pagination meta={refunds.meta} basePath="/admin/payments" params={{ view: "refunds", status, q: params.q }} />
            </>
          )}
        </>
      )}
    </>
  );
}
