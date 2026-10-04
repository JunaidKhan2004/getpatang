import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert, Badge } from "@/components/ui/feedback";
import type { AdminOrderDetail } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPKR, ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { AdminCancelOrder } from "./cancel-order";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Order") };
}

export default async function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const t = await getT();
  const { orderNumber } = await params;
  let o: AdminOrderDetail;
  try {
    o = await api<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(orderNumber)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const a = o.shippingAddress;
  const card = "grid gap-2 rounded-md border border-border bg-surface p-5 text-sm";

  return (
    <>
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/admin/orders" className="hover:text-primary">{t("Orders")}</Link> / {o.orderNumber}</nav>
      <PageHeader
        title={o.orderNumber}
        description={t("Placed {true}{number}", { true: formatDate(o.createdAt, true), number: o.customRequest ? ` · from custom request ${o.customRequest.number}` : "" })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_LABEL[o.status])}</Badge>
            <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{t(PAYMENT_STATUS_LABEL[o.paymentStatus])}</Badge>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section className={card} aria-labelledby="items">
            <h2 id="items" className="font-display font-semibold">{t("Items")}</h2>
            <ul className="divide-y divide-border">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2">
                  <span>{i.title}{i.variantName && <span className="text-muted"> · {i.variantName}</span>} <span className="text-muted">× {i.quantity}</span></span>
                  <span className="tabular-nums">{formatPKR(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t border-border pt-2">
              <div className="flex justify-between"><dt>{t("Items")}</dt><dd className="tabular-nums">{formatPKR(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>{t("Delivery ({deliveryMethod})", { deliveryMethod: o.deliveryMethod })}</dt><dd className="tabular-nums">{formatPKR(o.shippingFee)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt>{t("Discount")}{" "}{o.couponCode && `(${o.couponCode})`}</dt><dd className="tabular-nums">−{formatPKR(o.discount)}</dd></div>}
              <div className="flex justify-between font-semibold"><dt>{t("Total")}</dt><dd className="tabular-nums">{formatPKR(o.total)}</dd></div>
            </dl>
          </section>

          <section className={card} aria-labelledby="timeline">
            <h2 id="timeline" className="font-display font-semibold">{t("Timeline")}</h2>
            <ol className="grid gap-3">
              {o.events.map((e, i) => (
                <li key={i} className="grid gap-0.5 border-s-2 border-border ps-4">
                  <span className="font-medium">{t(ORDER_STATUS_LABEL[e.status])}</span>
                  {e.note && <span className="text-muted">{e.note}</span>}
                  <span className="text-xs text-muted">{formatDate(e.createdAt, true)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={card} aria-labelledby="payments">
            <h2 id="payments" className="font-display font-semibold">{t("Payments and refunds")}</h2>
            {o.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{o.paymentLabel} · {formatPKR(p.amount)}{p.reference && <> {" "}{t("· ref")}{" "}<span className="font-mono">{p.reference}</span></>}</span>
                <span className="flex items-center gap-2">
                  {p.proofUploadId && <a href={`/api/files/${p.proofUploadId}`} target="_blank" rel="noopener" className="text-primary hover:underline">{t("Receipt")}</a>}
                  <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{t(PAYMENT_STATUS_LABEL[p.status])}</Badge>
                </span>
              </div>
            ))}
            {o.refunds.map((r) => (
              <p key={r.id}>{t("Refund {amount}:", { amount: formatPKR(r.amount) })}{" "}{r.status === "COMPLETED" ? `sent (ref ${r.reference})` : "to send"} · <span className="text-muted">{r.reason}</span></p>
            ))}
            <Link href={`/admin/payments?q=${o.orderNumber}&status=ALL`} className="w-fit font-semibold text-primary hover:underline">{t("Open in payments")}</Link>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className={card} aria-labelledby="customer">
            <h2 id="customer" className="font-display font-semibold">{t("Customer")}</h2>
            <Link href={`/admin/users/${o.user.id}`} className="font-medium text-primary hover:underline">{o.user.fullName}</Link>
            <p className="text-muted">{[o.user.email, o.user.phone].filter(Boolean).join(" · ")}</p>
            <p>{a.fullName}, {a.phone}<br />{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(", ")}</p>
            {o.notes && <p className="text-muted">{t("Note: {notes}", { notes: o.notes })}</p>}
          </section>
          <section className={card} aria-labelledby="shop">
            <h2 id="shop" className="font-display font-semibold">{t("Shop")}</h2>
            <Link href={`/admin/sellers/${o.shop.id}`} className="font-medium text-primary hover:underline">{o.shop.name}</Link>
            <p className="text-muted">{[o.shop.phone, o.shop.email].filter(Boolean).join(" · ")}</p>
            {(o.courierName || o.trackingNumber) && <p>{t("Shipped with {Boolean}", { Boolean: [o.courierName, o.trackingNumber].filter(Boolean).join(", ") })}</p>}
          </section>
          {o.canCancel ? <AdminCancelOrder orderNumber={o.orderNumber} paid={o.paymentStatus === "PAID"} /> : <Alert>{t("This order can no longer be cancelled. Returns are handled by the shop.")}</Alert>}
        </aside>
      </div>
    </>
  );
}
