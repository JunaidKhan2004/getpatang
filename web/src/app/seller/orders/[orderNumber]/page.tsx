import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { ProductImage } from "@/components/market/product-card";
import { Badge } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/market";
import type { SellerOrderDetail } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { StatusUpdater } from "./status-updater";

export async function generateMetadata({ params }: { params: Promise<{ orderNumber: string }> }) {
  return { title: `Order ${(await params).orderNumber}` };
}

export default async function SellerOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  let o: SellerOrderDetail;
  try {
    o = await api<SellerOrderDetail>(`/seller/orders/${encodeURIComponent(orderNumber)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const a = o.shippingAddress;
  const box = "grid content-start gap-1 rounded-md border border-border bg-surface p-5 text-sm";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/seller/orders" className="hover:text-primary">Orders</Link> / {o.orderNumber}</nav>
      <PageHeader
        title={o.orderNumber}
        description={`Placed ${formatDate(o.createdAt, true)}`}
        actions={<Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          <StatusUpdater orderNumber={o.orderNumber} current={o.status} next={o.nextStatuses} />

          <section aria-labelledby="items" className="rounded-md border border-border bg-surface px-5">
            <h2 id="items" className="border-b border-border py-3 font-display font-semibold">Items to pack</h2>
            <ul className="divide-y divide-border">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex items-center gap-4 py-3">
                  <ProductImage image={i.imageUrl ? { url: i.imageUrl, alt: i.title } : null} title={i.title} className="size-14 shrink-0 rounded" />
                  <div className="grid min-w-0 flex-1">
                    <span className="font-medium">{i.title}</span>
                    <span className="text-sm text-muted">{i.variantName && `${i.variantName} · `}{formatPKR(i.unitPrice)} each</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">× {i.quantity}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t border-border py-3 text-sm tabular-nums">
              <div className="flex justify-between"><dt>Items</dt><dd>{formatPKR(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Shipping ({o.deliveryMethod})</dt><dd>{o.shippingFee ? formatPKR(o.shippingFee) : "Free"}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatPKR(o.discount)}</dd></div>}
              <div className="flex justify-between font-display text-base font-bold"><dt>Total</dt><dd>{formatPKR(o.total)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="timeline" className="rounded-md border border-border bg-surface p-5">
            <h2 id="timeline" className="mb-3 font-display font-semibold">Timeline</h2>
            <ol className="grid gap-3">
              {o.timeline.map((t, i) => (
                <li key={i} className="grid gap-0.5 border-l-2 border-border pl-4 text-sm">
                  <span className="font-medium">{ORDER_STATUS_LABEL[t.status]}</span>
                  {t.note && <span className="text-muted">{t.note}</span>}
                  <span className="text-xs text-muted">{formatDate(t.createdAt, true)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section aria-labelledby="ship" className={box}>
            <h2 id="ship" className="mb-1 font-display text-base font-semibold">Ship to</h2>
            <p className="font-medium">{a.fullName}</p>
            <p>{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(", ")}</p>
            <p><a href={`tel:${a.phone}`} className="text-primary hover:underline">{a.phone}</a></p>
            {o.notes && <p className="mt-2 rounded bg-primary-soft p-2">Customer note: {o.notes}</p>}
            {o.trackingNumber && <p className="mt-2 text-muted">{o.courierName} · tracking {o.trackingNumber}</p>}
          </section>
          <section aria-labelledby="cust" className={box}>
            <h2 id="cust" className="mb-1 font-display text-base font-semibold">Customer</h2>
            <p>{o.customer.name}</p>
            <p className="break-all text-muted">{o.customer.email}</p>
          </section>
          <section aria-labelledby="pay" className={box}>
            <h2 id="pay" className="mb-1 font-display text-base font-semibold">Payment</h2>
            <p>{o.payment.label}</p>
            <p className="text-muted">Status: {PAYMENT_STATUS_LABEL[o.payment.status as PaymentStatus] ?? o.payment.status.toLowerCase()}</p>
            {o.payment.method === "bank_transfer" && o.payment.status !== "PAID" && !["CANCELLED", "REFUNDED"].includes(o.status) && (
              <p className="text-muted">Wait until our team verifies the transfer before preparing. You will get a notification.</p>
            )}
            {o.payment.method === "cod" && o.status !== "DELIVERED" && <p className="text-muted">Collect {formatPKR(o.total)} in cash on delivery.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
