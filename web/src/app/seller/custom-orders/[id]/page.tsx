import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { CustomOrderSummary, CustomStatusBadge, MessageList, QuoteBox } from "@/components/designer/custom-order-view";
import { MessageComposer } from "@/components/designer/message-composer";
import { Alert } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import type { CustomOrder } from "@/lib/designer";
import { getAccessToken } from "@/lib/session";

import { SellerRequestActions } from "./seller-actions";

export const metadata = { title: "Custom order" };

const OPEN = ["REQUESTED", "CLARIFICATION_NEEDED", "QUOTED"];

export default async function SellerCustomOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let r: CustomOrder;
  try {
    r = await api<CustomOrder>(`/seller/custom-orders/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const open = OPEN.includes(r.status);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/seller/custom-orders" className="hover:text-primary">Custom orders</Link> / {r.number}</nav>
      <PageHeader title={r.designName} description={`From ${r.customer.name} · ${r.quantity} pcs`} actions={<CustomStatusBadge r={r} />} />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          {r.order && (
            <Alert tone="success">
              The customer accepted. Order <Link href={`/seller/orders/${r.order.orderNumber}`} className="font-semibold underline">{r.order.orderNumber}</Link> is in your orders.
            </Alert>
          )}
          {r.status === "CLARIFICATION_NEEDED" && <Alert>Waiting for the customer to answer your question.</Alert>}
          <QuoteBox r={r} />
          {open && <SellerRequestActions id={r.id} status={r.status} quantity={r.quantity} />}
          <section className="grid gap-4" aria-labelledby="thread">
            <h2 id="thread" className="text-lg font-semibold">Conversation</h2>
            <MessageList r={r} viewer="seller" />
            {open && <MessageComposer id={r.id} as="seller" />}
          </section>
        </div>
        <aside><CustomOrderSummary r={r} /></aside>
      </div>
    </>
  );
}
