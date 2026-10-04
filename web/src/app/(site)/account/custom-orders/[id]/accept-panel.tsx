"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AddressForm } from "@/app/(site)/checkout/checkout-form";
import { acceptQuoteAction, customOrderCommandAction } from "@/app/actions/custom-orders";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { type Address, type CheckoutOptions } from "@/lib/market";
import { useT, useFormat } from "@/lib/i18n/client";

export function AcceptPanel({ id, quotePrice, addresses: initialAddresses, options }: { id: string; quotePrice: number; addresses: Address[]; options: CheckoutOptions }) {
  const { formatPKR } = useFormat();
  const t = useT();
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [delivery, setDelivery] = useState(options.deliveryMethods[0]?.key ?? "");
  const [payment, setPayment] = useState(options.paymentMethods[0]?.key ?? "");
  const [pending, start] = useTransition();
  const method = options.deliveryMethods.find((m) => m.key === delivery);
  const fee = !method ? 0 : method.freeAbove !== null && quotePrice >= method.freeAbove ? 0 : method.fee;

  if (!addresses.length) {
    return (
      <section className="grid gap-3 rounded-md border border-border bg-surface p-5">
        <h2 className="font-display font-semibold">{t("Add a delivery address to accept")}</h2>
        <AddressForm
          onSaved={(a) => {
            setAddresses([a]);
            setAddressId(a.id);
          }}
        />
      </section>
    );
  }
  if (!options.paymentMethods.length) return <Alert tone="error">{t("Ordering is paused while payment methods are being set up. Please try again later.")}</Alert>;

  const accept = () =>
    start(async () => {
      const res = await acceptQuoteAction(id, { addressId, deliveryMethod: delivery, paymentMethod: payment });
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      router.refresh();
    });

  const radio = "flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft";
  return (
    <section className="grid gap-4 rounded-md border border-border bg-surface p-5" aria-labelledby="accept">
      <h2 id="accept" className="font-display font-semibold">{t("Accept and place the order")}</h2>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("Deliver to")}</legend>
        {addresses.map((a) => (
          <label key={a.id} className={radio}>
            <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-[var(--primary)]" />
            <span>{a.fullName} · {a.phone}<span className="block text-muted">{[a.line1, a.line2, a.city].filter(Boolean).join(", ")}</span></span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("Delivery")}</legend>
        {options.deliveryMethods.map((m) => (
          <label key={m.key} className={radio}>
            <input type="radio" name="delivery" checked={delivery === m.key} onChange={() => setDelivery(m.key)} className="mt-1 accent-[var(--primary)]" />
            <span>{m.label} · {m.fee ? formatPKR(m.fee) : t("Free")}<span className="block text-muted">{m.description}</span></span>
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("Payment")}</legend>
        {options.paymentMethods.map((p) => (
          <label key={p.key} className={radio}>
            <input type="radio" name="payment" checked={payment === p.key} onChange={() => setPayment(p.key)} className="mt-1 accent-[var(--primary)]" />
            <span>{p.label}<span className="block text-muted">{p.description}</span></span>
          </label>
        ))}
      </fieldset>
      <dl className="grid gap-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><dt>{t("Quote")}</dt><dd className="tabular-nums">{formatPKR(quotePrice)}</dd></div>
        <div className="flex justify-between"><dt>{t("Delivery")}</dt><dd className="tabular-nums">{fee ? formatPKR(fee) : t("Free")}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>{t("Total")}</dt><dd className="tabular-nums">{formatPKR(quotePrice + fee)}</dd></div>
      </dl>
      <Button loading={pending} disabled={!addressId || !delivery || !payment} onClick={accept}>{t("Accept quote and place order")}</Button>
    </section>
  );
}

export function RequestCommand({ id, command }: { id: string; command: "decline" | "cancel" }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() => {
        if (!window.confirm(command === "decline" ? t("Decline this quote?") : t("Cancel this request?"))) return;
        start(async () => {
          const res = await customOrderCommandAction(id, command);
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      {command === "decline" ? t("Decline quote") : t("Cancel request")}
    </Button>
  );
}
