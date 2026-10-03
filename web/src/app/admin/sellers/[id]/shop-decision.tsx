"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { shopDecisionAction, shopVerificationAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import type { ShopStatus } from "@/lib/seller";

const OPTIONS: Record<ShopStatus, { decision: string; label: string; variant: "primary" | "secondary" | "danger"; needsNote?: boolean }[]> = {
  PENDING: [
    { decision: "start_review", label: "Start review", variant: "secondary" },
    { decision: "approve", label: "Approve shop", variant: "primary" },
    { decision: "reject", label: "Ask for changes", variant: "danger", needsNote: true },
  ],
  UNDER_REVIEW: [
    { decision: "approve", label: "Approve shop", variant: "primary" },
    { decision: "reject", label: "Ask for changes", variant: "danger", needsNote: true },
  ],
  APPROVED: [{ decision: "suspend", label: "Suspend shop", variant: "danger", needsNote: true }],
  SUSPENDED: [{ decision: "reinstate", label: "Reinstate shop", variant: "primary" }],
  REJECTED: [],
};

export function ShopDecision({ shopId, status, isVerified }: { shopId: string; status: ShopStatus; isVerified: boolean }) {
  const [pending, start] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const options = OPTIONS[status];

  const decide = (decision: string) =>
    start(async () => {
      const res = await shopDecisionAction(shopId, decision, note.trim());
      if (res.ok) {
        toast.success(res.message);
        setNoteFor(null);
        setNote("");
      } else toast.error(res.message);
    });

  return (
    <section aria-labelledby="decision" className="grid gap-3 rounded-md border border-primary/30 bg-primary-soft p-5">
      <h2 id="decision" className="font-display font-semibold">Decision</h2>
      {status === "REJECTED" && <p className="text-sm text-muted">Waiting for the seller to fix and resubmit.</p>}
      {!noteFor && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <Button key={o.decision} variant={o.variant} disabled={pending} onClick={() => (o.needsNote ? setNoteFor(o.decision) : decide(o.decision))}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
      {noteFor && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            decide(noteFor);
          }}
        >
          <label htmlFor="note" className="text-sm font-medium">Reason (the seller will see this)</label>
          <textarea id="note" required maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={pending}>Confirm</Button>
            <Button type="button" variant="secondary" onClick={() => setNoteFor(null)}>Back</Button>
          </div>
        </form>
      )}
      {status === "APPROVED" && (
        <label className="mt-2 flex items-center gap-2 border-t border-primary/20 pt-3 text-sm">
          <input
            type="checkbox"
            defaultChecked={isVerified}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const res = await shopVerificationAction(shopId, e.target.checked);
                if (res.ok) toast.success(res.message);
                else toast.error(res.message);
              })
            }
            className="size-4 accent-[var(--primary)]"
          />
          Show the “Verified shop” badge
        </label>
      )}
    </section>
  );
}
