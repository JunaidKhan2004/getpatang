"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminCancelOrderAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

export function AdminCancelOrder({ orderNumber, paid }: { orderNumber: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  return (
    <section className="grid gap-3 rounded-md border border-border bg-surface p-5 text-sm" aria-labelledby="cancel">
      <h2 id="cancel" className="font-display font-semibold">Cancel order</h2>
      <p className="text-muted">Puts items back in stock and tells the customer and the shop.{paid && " The payment becomes a refund to send."}</p>
      {!open ? (
        <div><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Cancel this order</Button></div>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await adminCancelOrderAction(orderNumber, reason.trim());
              if (res.ok) {
                toast.success(res.message);
                router.refresh();
              } else toast.error(res.message);
            });
          }}
        >
          <label htmlFor="cancel-reason" className="font-medium">Reason (shown to both)</label>
          <textarea id="cancel-reason" required minLength={5} maxLength={300} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" loading={pending}>Cancel order</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>Keep</Button>
          </div>
        </form>
      )}
    </section>
  );
}
