"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createAddressAction, placeOrderAction, quoteAction } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import { type Address, type Cart, type CheckoutOptions, type Quote } from "@/lib/market";
import type { FormState } from "@/lib/types";
import { PAKISTAN_CITIES, PK_PHONE_PATTERN } from "@/lib/validation";
import { useT, useFormat } from "@/lib/i18n/client";

const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
const choice =
  "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-info";

export function AddressForm({ onSaved }: { onSaved: (a: Address) => void }) {
  const t = useT();
  const [state, action, pending] = useActionState(createAddressAction, {} as FormState & { address?: Address });
  const fe = state.fieldErrors ?? {};
  // Report each saved address once, even though the parent re-renders with a new callback.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (state.address && reported.current !== state.address.id) {
      reported.current = state.address.id;
      onSaved(state.address);
    }
  }, [state.address, onSaved]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error && <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div>}
      <Field label={t("Full name")} name="fullName" autoComplete="name" required defaultValue={state.values?.fullName} error={fe.fullName} />
      <Field label={t("Mobile number")} name="phone" type="tel" autoComplete="tel" required pattern={PK_PHONE_PATTERN} placeholder={t("03XX XXXXXXX")} defaultValue={state.values?.phone} error={fe.phone} />
      <Field label={t("Street address")} name="line1" autoComplete="address-line1" required className="sm:col-span-2" defaultValue={state.values?.line1} error={fe.line1} />
      <Field label={t("Area / landmark (optional)")} name="line2" autoComplete="address-line2" className="sm:col-span-2" defaultValue={state.values?.line2} error={fe.line2} />
      <SelectField label={t("City")} name="city" required options={PAKISTAN_CITIES} defaultValue={state.values?.city} error={fe.city} />
      <Field label={t("Postal code (optional)")} name="postalCode" inputMode="numeric" pattern="[0-9]{5}" autoComplete="postal-code" defaultValue={state.values?.postalCode} error={fe.postalCode} />
      <Field label={t("Label (optional)")} name="label" placeholder={t("Home, Work…")} defaultValue={state.values?.label} error={fe.label} />
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input type="checkbox" name="isDefault" className="size-4 accent-[var(--primary)]" /> {" "}{t("Make this my default address")}</label>
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" loading={pending}>{t("Save address")}</Button>
      </div>
    </form>
  );
}

export function CheckoutForm({ cart, addresses: initialAddresses, options }: { cart: Cart; addresses: Address[]; options: CheckoutOptions }) {
  const { formatPKR } = useFormat();
  const t = useT();
  const [checkoutId] = useState(() => crypto.randomUUID());
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses.find((a) => a.isDefault)?.id ?? initialAddresses[0]?.id ?? "");
  const [showNewAddress, setShowNewAddress] = useState(initialAddresses.length === 0);
  const [deliveryMethod, setDeliveryMethod] = useState(options.deliveryMethods[0]?.key ?? "");
  const [paymentMethod, setPaymentMethod] = useState(options.paymentMethods[0]?.key ?? "");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [couponError, setCouponError] = useState<string | undefined>();
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | undefined>();
  const [pricing, startPricing] = useTransition();
  const [placing, startPlacing] = useTransition();

  // Re-price whenever delivery method or coupon changes.
  useEffect(() => {
    startPricing(async () => {
      const res = await quoteAction(deliveryMethod, coupon);
      if (res.couponError) {
        setCouponError(res.couponError);
        setCoupon(undefined);
        return;
      }
      setQuote(res.quote ?? null);
      setQuoteError(res.error);
    });
  }, [deliveryMethod, coupon]);

  const onAddressSaved = (a: Address) => {
    setAddresses((list) => [a, ...list.filter((x) => x.id !== a.id).map((x) => (a.isDefault ? { ...x, isDefault: false } : x))]);
    setAddressId(a.id);
    setShowNewAddress(false);
    toast.success(t("Address saved."));
  };

  const place = () =>
    startPlacing(async () => {
      if (!addressId) {
        toast.error(t("Please add a delivery address."));
        return;
      }
      const res = await placeOrderAction({ checkoutId, addressId, deliveryMethod, paymentMethod, couponCode: coupon, notes: notes.trim() || undefined });
      // On success the action redirects; anything returned here is an error.
      if (res && !res.ok) toast.error(res.message ?? t("Could not place your order."));
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-6">
        <section aria-labelledby="addr" className={card}>
          <div className="flex items-center justify-between gap-4">
            <h2 id="addr" className="font-display text-lg font-semibold">{t("1. Delivery address")}</h2>
            {addresses.length > 0 && (
              <button type="button" onClick={() => setShowNewAddress((s) => !s)} className="text-sm font-semibold text-primary hover:underline">
                {showNewAddress ? t("Cancel") : t("Add new address")}
              </button>
            )}
          </div>
          {!showNewAddress && addresses.length > 0 && (
            <fieldset className="grid gap-3">
              <legend className="sr-only">{t("Choose a delivery address")}</legend>
              {addresses.map((a) => (
                <label key={a.id} className={choice}>
                  <input type="radio" name="address" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-[var(--primary)]" />
                  <span className="grid gap-0.5 text-sm">
                    <span className="font-semibold">{a.fullName}{a.label && <span className="font-normal text-muted"> · {a.label}</span>}</span>
                    <span>{[a.line1, a.line2, a.city, a.postalCode].filter(Boolean).join(", ")}</span>
                    <span className="text-muted">{a.phone}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {showNewAddress && <AddressForm onSaved={onAddressSaved} />}
        </section>

        <section aria-labelledby="delivery" className={card}>
          <h2 id="delivery" className="font-display text-lg font-semibold">{t("2. Delivery method")}</h2>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">{t("Choose a delivery method")}</legend>
            {options.deliveryMethods.map((m) => (
              <label key={m.key} className={choice}>
                <input type="radio" name="delivery" checked={deliveryMethod === m.key} onChange={() => setDeliveryMethod(m.key)} className="mt-1 accent-[var(--primary)]" />
                <span className="grid gap-0.5 text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-muted">{m.description}</span>
                  <span className="tabular-nums">
                    {t("{fee} per shop", { fee: formatPKR(m.fee) })}{m.freeAbove !== null && <span className="text-muted"> {" "}{t("· free above {freeAbove}", { freeAbove: formatPKR(m.freeAbove) })}</span>}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section aria-labelledby="payment" className={card}>
          <h2 id="payment" className="font-display text-lg font-semibold">{t("3. Payment")}</h2>
          <fieldset className="grid gap-3">
            <legend className="sr-only">{t("Choose a payment method")}</legend>
            {options.paymentMethods.map((m) => (
              <label key={m.key} className={choice}>
                <input type="radio" name="payment" checked={paymentMethod === m.key} onChange={() => setPaymentMethod(m.key)} className="mt-1 accent-[var(--primary)]" />
                <span className="grid gap-0.5 text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-muted">{m.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium">{t("Note for the shop (optional)")}</label>
            <textarea id="notes" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-md border border-border bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-4 rounded-md border border-border bg-surface p-5 lg:sticky lg:top-24" aria-busy={pricing}>
        <h2 className="font-display text-lg font-semibold">{t("Order summary")}</h2>
        <ul className="grid gap-3 text-sm">
          {(quote?.shops ?? cart.shops.map((s) => ({ ...s, shippingFee: 0, discount: 0, total: s.subtotal }))).map((s) => (
            <li key={s.shop.id} className="grid gap-1 border-b border-border pb-3">
              <span className="font-semibold">{s.shop.name}</span>
              {s.items.map((i) => (
                <span key={i.id} className="flex justify-between gap-3 text-muted">
                  <span className="min-w-0 truncate">{i.quantity} × {i.title}{i.variantName && ` (${i.variantName})`}</span>
                  <span className="tabular-nums">{formatPKR(i.lineTotal)}</span>
                </span>
              ))}
            </li>
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCouponError(undefined);
            setCoupon(couponInput.trim() || undefined);
          }}
        >
          <label htmlFor="coupon" className="sr-only">{t("Coupon code")}</label>
          <input
            id="coupon"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder={t("Coupon code")}
            aria-invalid={Boolean(couponError) || undefined}
            aria-describedby={couponError ? "coupon-error" : undefined}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm uppercase focus:border-primary focus:outline-none"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-10">{t("Apply")}</Button>
        </form>
        {couponError && <p id="coupon-error" className="-mt-2 text-sm text-danger">{couponError}</p>}
        {quote?.couponCode && <p className="-mt-2 text-sm text-success">{t("Coupon {couponCode} applied.", { couponCode: quote.couponCode })}</p>}

        {quoteError && <Alert tone="error">{quoteError}</Alert>}
        <dl className="grid gap-2 text-sm tabular-nums">
          <div className="flex justify-between"><dt>{t("Items")}</dt><dd>{formatPKR(quote?.subtotal ?? cart.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>{t("Shipping")}</dt><dd>{quote ? (quote.shippingFee ? formatPKR(quote.shippingFee) : t("Free")) : "…"}</dd></div>
          {quote && quote.discount > 0 && <div className="flex justify-between text-success"><dt>{t("Discount")}</dt><dd>−{formatPKR(quote.discount)}</dd></div>}
        </dl>
        <div className="flex justify-between border-t border-border pt-3 font-display text-xl font-bold tabular-nums">
          <span>{t("Total")}</span><span>{quote ? formatPKR(quote.total) : "…"}</span>
        </div>
        <Button size="lg" onClick={place} loading={placing} disabled={!quote || pricing || !addressId || !paymentMethod}>
          {t("Place order")}</Button>
        <p className="text-xs text-muted">{t("By placing your order you agree to the Terms of Service. You can cancel until the shop starts preparing it.")}</p>
      </aside>
    </div>
  );
}
