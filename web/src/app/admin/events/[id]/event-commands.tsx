"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { eventCommandAction } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import type { EventStatus } from "@/lib/events";
import { useT } from "@/lib/i18n/client";

export function EventCommands({ id, status }: { id: string; status: EventStatus }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const run = (command: "publish" | "cancel") =>
    start(async () => {
      const res = await eventCommandAction(id, command, reason || undefined);
      if (res.ok) {
        toast.success(res.message);
        setCancelling(false);
        router.refresh();
      } else toast.error(res.message);
    });

  if (status !== "DRAFT" && status !== "PUBLISHED") return null;
  if (cancelling) {
    return (
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); run("cancel"); }}>
        <label htmlFor="cancel-reason" className="sr-only">{t("Reason")}</label>
        <input id="cancel-reason" required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Reason, shown publicly")} className="h-10 w-64 rounded-md border border-border bg-surface px-3 text-sm" />
        <Button type="submit" size="sm" variant="danger" loading={pending}>{t("Cancel event")}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setCancelling(false)}>{t("Keep")}</Button>
      </form>
    );
  }
  return (
    <>
      {status === "DRAFT" && <Button size="sm" loading={pending} onClick={() => run("publish")}>{t("Publish")}</Button>}
      <Button size="sm" variant="secondary" onClick={() => setCancelling(true)}>{t("Cancel event")}</Button>
    </>
  );
}
