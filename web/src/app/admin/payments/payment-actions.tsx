"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { completeRefundAction, reviewPaymentAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

const input = "h-10 rounded-md border border-border bg-surface px-3 text-sm";

export function ReviewPayment({ id, canReject }: { id: string; canReject: boolean }) {
  const t = useT();
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const run = (decision: "approve" | "reject") =>
    start(async () => {
      const res = await reviewPaymentAction(id, decision, decision === "reject" ? note.trim() : undefined);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  if (rejecting) {
    return (
      <form className="flex flex-wrap items-start gap-2 self-start" onSubmit={(e) => { e.preventDefault(); run("reject"); }}>
        <label htmlFor={`note-${id}`} className="sr-only">{t("Reason shown to the customer")}</label>
        <input id={`note-${id}`} required minLength={5} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("What is wrong? Shown to the customer")} className={`${input} w-64`} />
        <Button type="submit" size="sm" variant="danger" loading={pending}>{t("Reject")}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setRejecting(false)}>{t("Back")}</Button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 self-start">
      <Button
        size="sm"
        loading={pending}
        onClick={() => {
          if (window.confirm(t("Confirm the money has arrived in the account?"))) run("approve");
        }}
      >
        {t("Mark as received")}</Button>
      {canReject && <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>{t("Reject")}</Button>}
    </div>
  );
}

export function CompleteRefund({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-start gap-2 self-start"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await completeRefundAction(id, reference.trim());
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      <label htmlFor={`ref-${id}`} className="sr-only">{t("Refund transaction reference")}</label>
      <input id={`ref-${id}`} required minLength={4} maxLength={64} value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Refund transaction reference")} className={`${input} w-56`} />
      <Button type="submit" size="sm" loading={pending}>{t("Mark as sent")}</Button>
    </form>
  );
}
