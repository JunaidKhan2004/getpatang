"use client";

import { Flag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reportAction } from "@/app/actions/community";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS } from "@/lib/community";
import { useT } from "@/lib/i18n/client";

/** Inline report form for any post, comment, user, product or shop. */
export function ReportButton({ targetType, targetId, label = "Report", compact = false }: { targetType: string; targetId: string; label?: string; compact?: boolean }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger ${compact ? "text-xs" : ""}`}>
        <Flag className="size-3.5" aria-hidden="true" /> {t(label)}
      </button>
    );
  }
  return (
    <form
      className="mt-2 grid w-full gap-2 rounded-md border border-border bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await reportAction(targetType, targetId, reason, details.trim());
          if (res.signIn) {
            router.push(`/login?next=${encodeURIComponent(pathname)}`);
            return;
          }
          if (res.ok) {
            toast.success(res.message);
            setOpen(false);
          } else toast.error(res.message);
        });
      }}
    >
      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-semibold">{t("Why are you reporting this?")}</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`reason-${targetId}`} required value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[var(--primary)]" />
            {t(r.label)}
          </label>
        ))}
      </fieldset>
      <label className="grid gap-1 text-sm">{t("Anything else? (optional)")}<textarea rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="danger" loading={pending} disabled={!reason}>{t("Send report")}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>{t("Cancel")}</Button>
      </div>
    </form>
  );
}
