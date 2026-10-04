import type { Metadata } from "next";
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
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Custom order") };
}

const OPEN = ["REQUESTED", "CLARIFICATION_NEEDED", "QUOTED"];

export default async function SellerCustomOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
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
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/seller/custom-orders" className="hover:text-primary">{t("Custom orders")}</Link> / {r.number}</nav>
      <PageHeader title={r.designName} description={t("From {name} · {quantity} pcs", { name: r.customer.name, quantity: r.quantity })} actions={<CustomStatusBadge r={r} />} />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          {r.order && (
            <Alert tone="success">
              {t("The customer accepted. Order")}{" "}<Link href={`/seller/orders/${r.order.orderNumber}`} className="font-semibold underline">{r.order.orderNumber}</Link> {" "}{t("is in your orders.")}</Alert>
          )}
          {r.status === "CLARIFICATION_NEEDED" && <Alert>{t("Waiting for the customer to answer your question.")}</Alert>}
          <QuoteBox r={r} />
          {open && <SellerRequestActions id={r.id} status={r.status} quantity={r.quantity} />}
          <section className="grid gap-4" aria-labelledby="thread">
            <h2 id="thread" className="text-lg font-semibold">{t("Conversation")}</h2>
            <MessageList r={r} viewer="seller" />
            {open && <MessageComposer id={r.id} as="seller" />}
          </section>
        </div>
        <aside><CustomOrderSummary r={r} /></aside>
      </div>
    </>
  );
}
