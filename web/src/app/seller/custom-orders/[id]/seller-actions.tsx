"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { sellerCustomOrderAction } from "@/app/actions/custom-orders";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { CustomOrderStatus } from "@/lib/designer";
import { useT, useFormat } from "@/lib/i18n/client";

type Mode = "quote" | "clarify" | "reject" | null;
const textarea = "w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function SellerRequestActions({ id, status, quantity }: { id: string; status: CustomOrderStatus; quantity: number }) {
  const { formatPKR } = useFormat();
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(status === "QUOTED" ? null : "quote");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();

  const send = (command: Exclude<Mode, null>, body: Record<string, unknown>) =>
    start(async () => {
      const res = await sellerCustomOrderAction(id, command, body);
      setErrors(res.fieldErrors ?? {});
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      setMode(null);
      router.refresh();
    });

  const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
  return (
    <section className={card} aria-labelledby="respond">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="respond" className="font-display font-semibold">{t("Respond")}</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "quote" ? "primary" : "secondary"} onClick={() => setMode("quote")}>{status === "QUOTED" ? t("Revise quote") : t("Send quote")}</Button>
          {status === "REQUESTED" && <Button size="sm" variant={mode === "clarify" ? "primary" : "secondary"} onClick={() => setMode("clarify")}>{t("Ask a question")}</Button>}
          <Button size="sm" variant={mode === "reject" ? "danger" : "secondary"} onClick={() => setMode("reject")}>{t("Decline")}</Button>
        </div>
      </div>

      {mode === "quote" && (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            send("quote", { price: Number(fd.get("price")), deliveryDays: Number(fd.get("deliveryDays")), validDays: Number(fd.get("validDays")), note: String(fd.get("note") ?? "").trim() || undefined });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("Total price (Rs)")} name="price" type="number" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} hint={price ? `${formatPKR(Math.round(Number(price) / quantity))} per piece` : t("For all {quantity} pieces", { quantity })} />
            <Field label={t("Ready in (days)")} name="deliveryDays" type="number" min={1} max={180} required defaultValue={7} error={errors.deliveryDays} />
            <Field label={t("Quote valid for (days)")} name="validDays" type="number" min={1} max={60} required defaultValue={7} error={errors.validDays} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="q-note" className="text-sm font-medium">{t("Note (optional)")}</label>
            <textarea id="q-note" name="note" rows={3} maxLength={1000} placeholder={t("Materials, what is included, anything the customer should know.")} className={textarea} />
          </div>
          <p className="text-xs text-muted">{t("Delivery is charged on top at the customer’s chosen delivery rate. Plain cotton string and paper materials only.")}</p>
          <div><Button type="submit" loading={pending}>{t("Send quote")}</Button></div>
        </form>
      )}

      {(mode === "clarify" || mode === "reject") && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const text = String(new FormData(e.currentTarget).get("text") ?? "").trim();
            send(mode, mode === "clarify" ? { body: text } : { reason: text });
          }}
        >
          <label htmlFor="r-text" className="text-sm font-medium">{mode === "clarify" ? t("Your question") : t("Reason (shown to the customer)")}</label>
          <textarea id="r-text" name="text" required minLength={mode === "reject" ? 5 : 1} maxLength={mode === "reject" ? 1000 : 2000} rows={3} className={textarea} />
          {(errors.body || errors.reason) && <p className="text-sm text-danger">{errors.body ?? errors.reason}</p>}
          <div><Button type="submit" variant={mode === "reject" ? "danger" : "primary"} loading={pending}>{mode === "clarify" ? t("Send question") : t("Decline request")}</Button></div>
        </form>
      )}
    </section>
  );
}
