"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { removeCartItemAction, updateCartItemAction } from "@/app/actions/shop";
import { Spinner } from "@/components/ui/button";
import { type CartLine as Line } from "@/lib/market";

import { QuantityStepper } from "./action-buttons";
import { ProductImage } from "./product-card";
import { useT, useFormat } from "@/lib/i18n/client";

export function CartLine({ line }: { line: Line }) {
  const { formatPKR } = useFormat();
  const t = useT();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message ?? t("Could not update your cart."));
      else if (res.message) toast.success(res.message);
    });

  const linkBtn = "text-sm font-medium text-primary hover:underline disabled:opacity-50";

  return (
    <li className="flex gap-4 py-4" aria-busy={pending}>
      <Link href={`/products/${line.slug}`} className="shrink-0">
        <ProductImage image={line.image} title={line.title} className="size-20 rounded-md border border-border sm:size-24" />
      </Link>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <Link href={`/products/${line.slug}`} className="font-display font-semibold hover:text-primary">{line.title}</Link>
            {line.variantName && <p className="text-sm text-muted">{line.variantName}</p>}
            <p className="text-sm text-muted tabular-nums">{t("{unitPrice} each", { unitPrice: formatPKR(line.unitPrice) })}</p>
          </div>
          <p className="font-semibold tabular-nums">{formatPKR(line.lineTotal)}</p>
        </div>
        {line.issue && <p role="alert" className="text-sm font-medium text-danger">{line.issue}</p>}
        <div className="flex flex-wrap items-center gap-4">
          {!line.savedForLater && line.available > 0 && (
            <QuantityStepper
              value={line.quantity}
              max={Math.min(99, Math.max(line.available, line.quantity))}
              disabled={pending}
              onChange={(quantity) => run(() => updateCartItemAction(line.id, { quantity }))}
              label={t("Quantity of {title}", { title: line.title })}
            />
          )}
          <button type="button" className={linkBtn} disabled={pending} onClick={() => run(() => updateCartItemAction(line.id, { savedForLater: !line.savedForLater }))}>
            {line.savedForLater ? t("Move to cart") : t("Save for later")}
          </button>
          <button type="button" className={linkBtn} disabled={pending} onClick={() => run(() => removeCartItemAction(line.id))}>
            {t("Remove")}</button>
          {pending && <Spinner />}
        </div>
      </div>
    </li>
  );
}
