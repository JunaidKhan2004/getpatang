import type { Metadata } from "next";
import Link from "next/link";

import { CartLine } from "@/components/market/cart-line";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { type Cart, formatPKR } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Cart") };
}

export default async function CartPage() {
  const t = await getT();
  await requireUser("/cart");
  const cart = await api<Cart>("/cart", { token: await getAccessToken() }).catch(() => null);

  if (!cart) {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><Alert tone="error">{t("We could not load your cart. Please refresh the page.")}</Alert></div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold">{t("Your cart")}</h1>

      {cart.shops.length === 0 ? (
        <EmptyState title={t("Your cart is empty")} message={t("Find kites and accessories from verified shops.")} action={<ButtonLink href="/marketplace">{t("Browse the marketplace")}</ButtonLink>} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-4">
            {cart.shops.length > 1 && (
              <Alert>{t("Your items come from {shops} shops, so they arrive as {shops} separate orders.", { shops: cart.shops.length })}</Alert>
            )}
            {cart.shops.map((group) => (
              <section key={group.shop.id} aria-label={t("Items from {name}", { name: group.shop.name })} className="rounded-md border border-border bg-surface px-4">
                <h2 className="border-b border-border py-3 font-display text-sm font-semibold">
                  <Link href={`/shops/${group.shop.slug}`} className="hover:text-primary">{group.shop.name}</Link>
                  <span className="font-normal text-muted"> · {group.shop.city}</span>
                </h2>
                <ul className="divide-y divide-border">{group.items.map((l) => <CartLine key={l.id} line={l} />)}</ul>
              </section>
            ))}
          </div>

          <aside className="grid content-start gap-4 rounded-md border border-border bg-surface p-5 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-semibold">{t("Order summary")}</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between"><dt>{t("Items ({itemCount})", { itemCount: cart.itemCount })}</dt><dd className="tabular-nums">{formatPKR(cart.subtotal)}</dd></div>
              <div className="flex justify-between text-muted"><dt>{t("Shipping")}</dt><dd>{t("Calculated at checkout")}</dd></div>
            </dl>
            <div className="flex justify-between border-t border-border pt-3 font-display text-lg font-semibold">
              <span>{t("Subtotal")}</span><span className="tabular-nums">{formatPKR(cart.subtotal)}</span>
            </div>
            {!cart.canCheckout && <p className="text-sm text-danger">{t("Fix the items marked in red to continue.")}</p>}
            {cart.canCheckout ? (
              <ButtonLink href="/checkout" size="lg">{t("Proceed to checkout")}</ButtonLink>
            ) : (
              <span aria-disabled="true" className="inline-flex h-12 items-center justify-center rounded-md bg-primary/40 font-display font-semibold text-primary-ink">{t("Proceed to checkout")}</span>
            )}
          </aside>
        </div>
      )}

      {cart.savedForLater.length > 0 && (
        <section aria-labelledby="saved" className="mt-10 rounded-md border border-border bg-surface px-4">
          <h2 id="saved" className="border-b border-border py-3 font-display font-semibold">{t("Saved for later ({savedForLater})", { savedForLater: cart.savedForLater.length })}</h2>
          <ul className="divide-y divide-border">{cart.savedForLater.map((l) => <CartLine key={l.id} line={l} />)}</ul>
        </section>
      )}
    </div>
  );
}
