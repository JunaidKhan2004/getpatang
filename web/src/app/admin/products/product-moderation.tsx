"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { productDecisionAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import type { ProductStatus } from "@/lib/seller";
import { useT } from "@/lib/i18n/client";

const ACTIONS: Record<ProductStatus, { decision: string; label: string; variant: "primary" | "secondary" | "danger"; needsNote?: boolean }[]> = {
  PENDING_APPROVAL: [
    { decision: "approve", label: "Approve", variant: "primary" },
    { decision: "reject", label: "Reject", variant: "secondary", needsNote: true },
    { decision: "remove", label: "Remove (unsafe)", variant: "danger", needsNote: true },
  ],
  ACTIVE: [
    { decision: "hide", label: "Hide", variant: "secondary", needsNote: true },
    { decision: "remove", label: "Remove", variant: "danger", needsNote: true },
  ],
  HIDDEN: [
    { decision: "approve", label: "Make live again", variant: "primary" },
    { decision: "remove", label: "Remove", variant: "danger", needsNote: true },
  ],
  REJECTED: [{ decision: "approve", label: "Approve anyway", variant: "secondary" }],
  DRAFT: [],
  REMOVED: [],
};

export function ProductModeration({ productId, status, slug }: { productId: string; status: ProductStatus; slug: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const decide = (decision: string) =>
    start(async () => {
      const res = await productDecisionAction(productId, decision, note.trim());
      if (res.ok) {
        toast.success(res.message);
        setDone(decision);
      } else toast.error(res.message);
    });

  if (done) return <p className="self-center text-sm font-medium text-success">{t("Done: {done}.", { done })}</p>;
  return (
    <div className="grid content-start gap-2">
      {status === "ACTIVE" && <a href={`/products/${slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">{t("View live page")}</a>}
      {!noteFor ? (
        ACTIONS[status].map((a) => (
          <Button key={a.decision} size="sm" variant={a.variant} disabled={pending} onClick={() => (a.needsNote ? setNoteFor(a.decision) : decide(a.decision))}>
            {t(a.label)}
          </Button>
        ))
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            decide(noteFor);
          }}
        >
          <label htmlFor={`note-${productId}`} className="text-sm font-medium">{t("Reason for the seller")}</label>
          <textarea id={`note-${productId}`} required rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" loading={pending}>{t("Confirm")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setNoteFor(null)}>{t("Back")}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
