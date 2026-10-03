"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { disputeAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";

/** Shown to a player on their own live or finished match. */
export function DisputeButton({ matchId, slug }: { matchId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-warning hover:underline">Dispute</button>;
  }
  return (
    <form
      className="mt-2 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await disputeAction(matchId, slug, reason.trim());
          if (res.ok) {
            toast.success(res.message);
            setOpen(false);
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      <label htmlFor={`d-${matchId}`} className="text-xs font-medium">What went wrong?</label>
      <textarea id={`d-${matchId}`} required minLength={10} maxLength={1000} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Send dispute</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
