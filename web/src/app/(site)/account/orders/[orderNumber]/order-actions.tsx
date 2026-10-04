"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitPaymentProofAction } from "@/app/actions/notifications";
import { cancelOrderAction, submitReviewAction } from "@/app/actions/shop";
import { SingleUpload, type Uploaded } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

export function CancelOrder({ orderNumber }: { orderNumber: string }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (!confirming) {
    return <Button variant="secondary" onClick={() => setConfirming(true)}>{t("Cancel order")}</Button>;
  }
  return (
    <div role="dialog" aria-labelledby="cancel-title" className="grid w-full max-w-md gap-3 rounded-md border border-danger/40 bg-surface p-4">
      <p id="cancel-title" className="font-display font-semibold">{t("Cancel this order?")}</p>
      <label htmlFor="cancel-reason" className="text-sm text-muted">{t("Reason (optional, shared with the shop)")}</label>
      <input id="cancel-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
      <div className="flex gap-2">
        <Button
          variant="danger"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelOrderAction(orderNumber, reason.trim());
              if (res.ok) {
                toast.success(res.message ?? t("Order cancelled."));
                setConfirming(false);
              } else toast.error(res.message ?? t("Could not cancel the order."));
            })
          }
        >
          {t("Yes, cancel order")}</Button>
        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>{t("Keep order")}</Button>
      </div>
    </div>
  );
}

export function ReviewItem({ productSlug }: { productSlug: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) return <p className="text-sm text-success">{t("Thanks for your review.")}</p>;
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="w-fit text-sm font-semibold text-primary hover:underline">{t("Write a review")}</button>;
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) {
          toast.error(t("Choose a star rating first."));
          return;
        }
        start(async () => {
          const res = await submitReviewAction(productSlug, rating, comment.trim());
          if (res.ok) {
            toast.success(res.message ?? t("Review published."));
            setDone(true);
          } else toast.error(res.message ?? t("Could not publish your review."));
        });
      }}
    >
      <fieldset className="flex gap-1">
        <legend className="sr-only">{t("Rating")}</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer text-2xl leading-none">
            <input type="radio" name={`rating-${productSlug}`} value={n} className="sr-only" onChange={() => setRating(n)} />
            <span aria-hidden="true" className={n <= rating ? "text-highlight" : "text-border"}>★</span>
            <span className="sr-only">{t("{n} star", { n })}{n > 1 ? "s" : ""}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={`review-${productSlug}`} className="sr-only">{t("Your review")}</label>
      <textarea id={`review-${productSlug}`} rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("What did you like or dislike?")} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>{t("Publish review")}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
      </div>
    </form>
  );
}

/** Bank transfer: the customer sends the transaction reference and, optionally, a receipt. */
export function PaymentProofForm({ orderNumber, resubmit }: { orderNumber: string; resubmit: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(!resubmit);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<Uploaded | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t("Update transfer details")}</Button>;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitPaymentProofAction(orderNumber, { reference: reference.trim(), proofUploadId: receipt?.id || undefined });
          setError(res.fieldErrors?.reference);
          if (res.ok) {
            toast.success(res.message ?? t("Thanks. We will confirm your payment after checking it."));
            setOpen(false);
          } else toast.error(res.message);
        });
      }}
    >
      <Field label={t("Transaction reference")} value={reference} onChange={(e) => setReference(e.target.value)} required minLength={4} maxLength={64} error={error} hint={t("From your bank app or receipt.")} />
      <SingleUpload label={t("Receipt (optional)")} purpose="payment_proof" value={receipt} onChange={setReceipt} hint={t("Screenshot or PDF. Only our payments team can see it.")} />
      <div><Button type="submit" size="sm" loading={pending}>{t("I have paid")}</Button></div>
    </form>
  );
}
