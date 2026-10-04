import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { Address, Cart, CheckoutOptions } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

import { CheckoutForm } from "./checkout-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Checkout") };
}

export default async function CheckoutPage() {
  const t = await getT();
  await requireUser("/checkout");
  const token = await getAccessToken();
  const [cart, addresses, options] = await Promise.all([
    api<Cart>("/cart", { token }),
    api<Address[]>("/addresses", { token }),
    api<CheckoutOptions>("/checkout/options", { token }),
  ]).catch(() => [null, null, null] as const);

  if (!cart || !addresses || !options) {
    return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><Alert tone="error">{t("Checkout could not load. Please refresh the page.")}</Alert></div>;
  }
  if (!cart.shops.length || !cart.canCheckout) redirect("/cart");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold">{t("Checkout")}</h1>
      {options.paymentMethods.length === 0 ? (
        <Alert tone="error">{t("Ordering is paused while payment methods are being set up. Please try again later.")}</Alert>
      ) : (
        <CheckoutForm cart={cart} addresses={addresses} options={options} />
      )}
    </div>
  );
}
