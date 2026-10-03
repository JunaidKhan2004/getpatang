"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { moderateAction } from "@/app/actions/community";
import { Button } from "@/components/ui/button";

const CONTENT_ACTIONS = [
  { action: "dismiss", label: "Dismiss reports (keep visible)", variant: "secondary" as const, note: false },
  { action: "hide", label: "Hide", variant: "secondary" as const, note: true },
  { action: "remove", label: "Remove", variant: "danger" as const, note: true },
];
const OTHER_ACTIONS = [
  { action: "dismiss", label: "Dismiss", variant: "secondary" as const, note: false },
  { action: "resolve", label: "Mark resolved", variant: "primary" as const, note: false },
];

export function ModerationActions({ targetType, targetId }: { targetType: string; targetId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const actions = targetType === "post" || targetType === "comment" ? CONTENT_ACTIONS : OTHER_ACTIONS;

  if (done) return <p className="self-center text-sm font-medium text-success">Done: {done}.</p>;
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={`mn-${targetId}`} className="text-xs font-medium">Note (required to hide or remove; shown to the author)</label>
      <textarea id={`mn-${targetId}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
      {actions.map((a) => (
        <Button
          key={a.action}
          size="sm"
          variant={a.variant}
          disabled={pending || (a.note && !note.trim())}
          onClick={() =>
            start(async () => {
              const res = await moderateAction(targetType, targetId, a.action, note.trim());
              if (res.ok) {
                toast.success(res.message);
                setDone(a.action);
              } else toast.error(res.message);
            })
          }
        >
          {a.label}
        </Button>
      ))}
      {!(targetType === "post" || targetType === "comment") && (
        <p className="text-xs text-muted">Make the actual change from the {targetType}&apos;s own admin page, then mark the reports resolved.</p>
      )}
    </div>
  );
}
