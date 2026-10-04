import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomOrderSummary, CustomStatusBadge, MessageList, QuoteBox } from "@/components/designer/custom-order-view";
import { MessageComposer } from "@/components/designer/message-composer";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import type { CustomOrder } from "@/lib/designer";
import type { Address, CheckoutOptions } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

import { AcceptPanel, RequestCommand } from "./accept-panel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Custom order") };
}

const OPEN = ["REQUESTED", "CLARIFICATION_NEEDED", "QUOTED"];

export default async function CustomOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  await requireUser(`/account/custom-orders/${id}`);
  const token = await getAccessToken();
  let r: CustomOrder;
  try {
    r = await api<CustomOrder>(`/custom-orders/${encodeURIComponent(id)}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const canAccept = r.status === "QUOTED" && !r.quoteExpired;
  const [addresses, options] = canAccept
    ? await Promise.all([api<Address[]>("/addresses", { token }), api<CheckoutOptions>("/checkout/options", { token })]).catch(() => [null, null] as const)
    : [null, null];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/account/custom-orders" className="hover:text-primary">{t("Custom orders")}</Link> / {r.number}</nav>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{r.designName}</h1>
        <CustomStatusBadge r={r} />
        <span className="text-sm text-muted">{t("from")}{" "}<Link href={`/shops/${r.shop.slug}`} className="text-primary hover:underline">{r.shop.name}</Link></span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-6">
          {r.status === "CLARIFICATION_NEEDED" && <Alert>{t("The shop asked a question. Reply below so they can quote.")}</Alert>}
          {r.order && (
            <Alert tone="success">
              {t("Order {orderNumber} was placed.", { orderNumber: r.order.orderNumber })}{" "}<Link href={`/account/orders/${r.order.orderNumber}`} className="font-semibold underline">{t("Track it")}</Link>
            </Alert>
          )}
          <QuoteBox r={r} />
          {canAccept && (addresses && options ? <AcceptPanel id={r.id} quotePrice={r.quote!.price} addresses={addresses} options={options} /> : <Alert tone="error">{t("Checkout options could not load. Please refresh.")}</Alert>)}
          {r.status === "QUOTED" && r.quoteExpired && <Alert>{t("This quote has expired. Message the shop to ask for a new one.")}</Alert>}

          <section className="grid gap-4" aria-labelledby="thread">
            <h2 id="thread" className="text-lg font-semibold">{t("Conversation")}</h2>
            <MessageList r={r} viewer="customer" />
            {OPEN.includes(r.status) && <MessageComposer id={r.id} as="customer" />}
          </section>

          <div className="flex flex-wrap gap-2">
            {r.status === "QUOTED" && <RequestCommand id={r.id} command="decline" />}
            {OPEN.includes(r.status) && <RequestCommand id={r.id} command="cancel" />}
            {!OPEN.includes(r.status) && <ButtonLink href={`/account/custom-orders/new`} variant="secondary">{t("New request")}</ButtonLink>}
          </div>
        </div>
        <aside><CustomOrderSummary r={r} /></aside>
      </div>
    </div>
  );
}
