import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Order placed") };
}

interface CheckoutResult {
  checkoutId: string;
  paymentMethod: string;
  paymentInstructions: string | null;
  total: number;
  orders: { orderNumber: string; shopName: string; total: number }[];
}

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const t = await getT();
  await requireUser("/account/orders");
  const { id } = await searchParams;
  if (!id) redirect("/account/orders");
  const result = await api<CheckoutResult>(`/checkout/${encodeURIComponent(id)}`, { token: await getAccessToken() }).catch(() => null);
  if (!result) redirect("/account/orders");

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-12 sm:px-6">
      <div className="grid justify-items-center gap-3 text-center">
        <CircleCheck className="size-14 text-success" aria-hidden="true" />
        <h1 className="text-3xl font-bold">{t("Thank you, your order is placed")}</h1>
        <p className="text-muted">
          {result.orders.length > 1
            ? t("Your items come from {orders} shops, so you have {orders} orders.", { orders: result.orders.length })
            : t("The shop will confirm your order soon.")}
        </p>
      </div>

      {result.paymentInstructions && <Alert>{result.paymentInstructions}</Alert>}
      {result.paymentMethod === "bank_transfer" && (
        <p className="text-sm text-muted">{t("After transferring, open your order and send the transaction reference so we can verify it.")}</p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {result.orders.map((o) => (
          <li key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="grid">
              <Link href={`/account/orders/${o.orderNumber}`} className="font-display font-semibold text-primary hover:underline">{o.orderNumber}</Link>
              <span className="text-sm text-muted">{o.shopName}</span>
            </div>
            <span className="font-semibold tabular-nums">{formatPKR(o.total)}</span>
          </li>
        ))}
        <li className="flex justify-between p-4 font-display text-lg font-bold tabular-nums"><span>{t("Total")}</span><span>{formatPKR(result.total)}</span></li>
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/account/orders">{t("View my orders")}</ButtonLink>
        <ButtonLink href="/marketplace" variant="secondary">{t("Continue shopping")}</ButtonLink>
      </div>
    </div>
  );
}
