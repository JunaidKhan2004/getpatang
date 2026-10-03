import { Check, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/market/product-card";
import { Alert, Badge } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderDetail, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

import { CancelOrder, PaymentProofForm, ReviewItem } from "./order-actions";

export async function generateMetadata({ params }: { params: Promise<{ orderNumber: string }> }): Promise<Metadata> {
  return { title: `Order ${(await params).orderNumber}` };
}

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  await requireUser(`/account/orders/${orderNumber}`);
  let order: OrderDetail;
  try {
    order = await api<OrderDetail>(`/orders/${encodeURIComponent(orderNumber)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const stopped = ["CANCELLED", "REFUNDED", "RETURNED"].includes(order.status);
  const reached = order.progress.indexOf(order.status);
  const eventTime = (status: string) => order.timeline.find((t) => t.status === status)?.createdAt;
  const addr = order.shippingAddress;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/account" className="hover:text-primary">My account</Link> / <Link href="/account/orders" className="hover:text-primary">Orders</Link> / {order.orderNumber}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
            {order.orderNumber}
            <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          </h1>
          <p className="text-sm text-muted">Placed {formatDate(order.createdAt, true)} · {order.shop.name}</p>
        </div>
        {order.canCancel && <CancelOrder orderNumber={order.orderNumber} />}
      </div>

      {order.payment?.instructions && order.payment.status === "PENDING" && !stopped && <Alert>{order.payment.instructions}</Alert>}
      {order.payment?.reviewNote && order.payment.status === "PENDING" && !stopped && <Alert tone="error">We could not verify your payment: {order.payment.reviewNote}</Alert>}
      {order.payment?.canSubmitProof && (
        <section aria-labelledby="transfer" className="grid gap-3 rounded-md border border-border bg-surface p-5">
          <h2 id="transfer" className="font-display font-semibold">
            {order.payment.status === "VERIFYING" ? "We are checking your transfer" : "Paid by bank transfer? Tell us"}
          </h2>
          {order.payment.status === "VERIFYING" && (
            <p className="text-sm text-muted">Reference {order.payment.reference}, sent {order.payment.submittedAt && formatDate(order.payment.submittedAt, true)}. The shop starts preparing once it is verified.</p>
          )}
          <PaymentProofForm orderNumber={order.orderNumber} resubmit={order.payment.status === "VERIFYING"} />
        </section>
      )}
      {order.refunds.map((r, i) => (
        <Alert key={i} tone={r.status === "COMPLETED" ? "success" : "info"}>
          {r.status === "COMPLETED"
            ? `Refund of ${formatPKR(r.amount)} sent${r.reference ? ` (reference ${r.reference})` : ""}${r.processedAt ? ` on ${formatDate(r.processedAt)}` : ""}.`
            : `A refund of ${formatPKR(r.amount)} is being processed. We will notify you when it is sent.`}
        </Alert>
      ))}

      <section aria-labelledby="progress" className="rounded-md border border-border bg-surface p-5">
        <h2 id="progress" className="mb-4 font-display font-semibold">Order progress</h2>
        {stopped ? (
          <ol className="grid gap-3">
            {order.timeline.map((t, i) => (
              <li key={i} className="grid gap-0.5 border-l-2 border-border pl-4">
                <span className="font-medium">{ORDER_STATUS_LABEL[t.status]}</span>
                {t.note && <span className="text-sm text-muted">{t.note}</span>}
                <span className="text-xs text-muted">{formatDate(t.createdAt, true)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="grid gap-4 sm:grid-cols-6 sm:gap-2">
            {order.progress.map((s, i) => {
              const done = i <= reached;
              const at = eventTime(s);
              return (
                <li key={s} className="flex items-center gap-3 sm:grid sm:justify-items-center sm:text-center" aria-current={i === reached ? "step" : undefined}>
                  <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-ink" : "border-border text-muted"}`}>
                    {done ? <Check className="size-4" aria-hidden="true" /> : <span className="text-xs">{i + 1}</span>}
                  </span>
                  <span className="grid">
                    <span className={`text-sm font-medium ${done ? "" : "text-muted"}`}>{ORDER_STATUS_LABEL[s]}</span>
                    {at && <span className="text-xs text-muted">{formatDate(at, true)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="items" className="rounded-md border border-border bg-surface px-5">
          <h2 id="items" className="border-b border-border py-3 font-display font-semibold">Items</h2>
          <ul className="divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-4">
                <ProductImage image={i.imageUrl ? { url: i.imageUrl, alt: i.title } : null} title={i.title} className="size-16 shrink-0 rounded-md border border-border" />
                <div className="grid min-w-0 flex-1 gap-1">
                  {i.productSlug ? (
                    <Link href={`/products/${i.productSlug}`} className="font-medium hover:text-primary">{i.title}</Link>
                  ) : (
                    <span className="font-medium">{i.title}</span>
                  )}
                  <span className="text-sm text-muted">
                    {i.variantName && `${i.variantName} · `}{i.quantity} × {formatPKR(i.unitPrice)}
                  </span>
                  {i.canReview && i.productSlug && <ReviewItem productSlug={i.productSlug} />}
                </div>
                <span className="font-semibold tabular-nums">{formatPKR(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-2 border-t border-border py-4 text-sm tabular-nums">
            <div className="flex justify-between"><dt>Items</dt><dd>{formatPKR(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shippingFee ? formatPKR(order.shippingFee) : "Free"}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-success"><dt>Discount{order.couponCode && ` (${order.couponCode})`}</dt><dd>−{formatPKR(order.discount)}</dd></div>}
            <div className="flex justify-between font-display text-lg font-bold"><dt>Total</dt><dd>{formatPKR(order.total)}</dd></div>
          </dl>
        </section>

        <div className="grid content-start gap-4">
          <section aria-labelledby="ship" className="grid gap-1 rounded-md border border-border bg-surface p-5 text-sm">
            <h2 id="ship" className="mb-1 font-display font-semibold">Delivery</h2>
            <p className="font-medium">{addr.fullName}</p>
            <p>{[addr.line1, addr.line2, addr.city, addr.postalCode].filter(Boolean).join(", ")}</p>
            <p className="text-muted">{addr.phone}</p>
            {order.notes && <p className="mt-2 text-muted">Note: {order.notes}</p>}
          </section>
          {order.payment && (
            <section aria-labelledby="pay" className="grid gap-1 rounded-md border border-border bg-surface p-5 text-sm">
              <h2 id="pay" className="mb-1 font-display font-semibold">Payment</h2>
              <p>{order.payment.label}</p>
              <p><Badge tone={PAYMENT_STATUS_TONE[order.payment.status]}>{PAYMENT_STATUS_LABEL[order.payment.status]}</Badge></p>
            </section>
          )}
          <section aria-labelledby="help" className="grid gap-2 rounded-md border border-border bg-surface p-5 text-sm">
            <h2 id="help" className="font-display font-semibold">Need help with this order?</h2>
            <p className="text-muted">Contact {order.shop.name} directly:</p>
            {order.shop.phone && <a href={`tel:${order.shop.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="size-4" aria-hidden="true" />{order.shop.phone}</a>}
            {order.shop.email && <a href={`mailto:${order.shop.email}`} className="flex items-center gap-2 break-all text-primary hover:underline"><Mail className="size-4 shrink-0" aria-hidden="true" />{order.shop.email}</a>}
          </section>
        </div>
      </div>
    </div>
  );
}
