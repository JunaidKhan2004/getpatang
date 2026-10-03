"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateOrderStatusAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/market";
import { ORDER_ACTION_LABEL } from "@/lib/seller";

/** Buttons for the allowed next statuses; shipping and cancelling ask for details first. */
export function StatusUpdater({ orderNumber, current, next }: { orderNumber: string; current: OrderStatus; next: OrderStatus[] }) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [restock, setRestock] = useState(true);
  const [pending, start] = useTransition();
  const [sending, setSending] = useState<OrderStatus | null>(null);

  if (next.length === 0) {
    return <p className="rounded-md border border-border bg-surface p-5 text-sm text-muted">This order is {ORDER_STATUS_LABEL[current].toLowerCase()}. No further steps.</p>;
  }

  const send = (status: OrderStatus) => {
    setSending(status);
    start(async () => {
      const res = await updateOrderStatusAction(orderNumber, {
        status,
        note: note.trim() || undefined,
        ...(status === "SHIPPED" && { courierName: courier.trim() || undefined, trackingNumber: tracking.trim() || undefined }),
        ...(status === "RETURNED" && { restock }),
      });
      if (res.ok) {
        toast.success(res.message);
        setTarget(null);
        setNote("");
      } else toast.error(res.message);
    });
  };

  const needsForm = (s: OrderStatus) => s === "SHIPPED" || s === "CANCELLED" || s === "RETURNED";
  const forward = next.filter((s) => s !== "CANCELLED" && s !== "RETURNED");
  const exits = next.filter((s) => s === "CANCELLED" || s === "RETURNED");

  return (
    <section aria-labelledby="next-step" className="grid gap-4 rounded-md border border-primary/30 bg-primary-soft p-5">
      <h2 id="next-step" className="font-display font-semibold">Next step</h2>
      {!target && (
        <div className="flex flex-wrap gap-2">
          {forward.map((s, i) => (
            <Button key={s} variant={i === 0 ? "primary" : "secondary"} loading={pending && sending === s} disabled={pending} onClick={() => (needsForm(s) ? setTarget(s) : send(s))}>
              {ORDER_ACTION_LABEL[s]}
            </Button>
          ))}
          {exits.map((s) => (
            <Button key={s} variant="secondary" className="!text-danger" onClick={() => setTarget(s)}>{ORDER_ACTION_LABEL[s]}</Button>
          ))}
        </div>
      )}
      {target && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(target);
          }}
        >
          <p className="font-medium">{ORDER_ACTION_LABEL[target]}</p>
          {target === "SHIPPED" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Courier (optional)" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="TCS, Leopards, M&P…" maxLength={60} />
              <Field label="Tracking number (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} />
            </div>
          )}
          {target === "RETURNED" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Put the items back into stock
            </label>
          )}
          <Field
            label={target === "CANCELLED" ? "Reason for the customer" : "Note for the customer (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required={target === "CANCELLED"}
            maxLength={300}
          />
          <div className="flex gap-2">
            <Button type="submit" variant={target === "CANCELLED" ? "danger" : "primary"} loading={pending}>Confirm</Button>
            <Button type="button" variant="secondary" onClick={() => setTarget(null)} disabled={pending}>Back</Button>
          </div>
        </form>
      )}
    </section>
  );
}
