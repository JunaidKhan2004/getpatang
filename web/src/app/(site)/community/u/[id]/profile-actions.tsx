"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { blockAction, followAction } from "@/app/actions/community";
import { ReportButton } from "@/components/community/report-button";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function ProfileActions({ userId, isFollowing, isBlocked }: { userId: string; isFollowing: boolean; isBlocked: boolean }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [confirmBlock, setConfirmBlock] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; signIn?: boolean }>) =>
    start(async () => {
      const res = await fn();
      if (res.signIn) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
      if (res.ok) {
        toast.success(res.message);
        setConfirmBlock(false);
        router.refresh();
      } else toast.error(res.message);
    });

  if (isBlocked) return <Button variant="secondary" loading={pending} onClick={() => run(() => blockAction(userId, false))}>{t("Unblock")}</Button>;

  return (
    <div className="grid justify-items-end gap-2">
      <div className="flex gap-2">
        <Button variant={isFollowing ? "secondary" : "primary"} aria-pressed={isFollowing} loading={pending} onClick={() => run(() => followAction(userId, !isFollowing))}>
          {isFollowing ? t("Following") : t("Follow")}
        </Button>
        <Button variant="secondary" onClick={() => setConfirmBlock((c) => !c)}>{t("Block")}</Button>
      </div>
      {confirmBlock && (
        <div className="grid max-w-xs gap-2 rounded-md border border-border bg-surface p-3 text-sm">
          <p>{t("Block this person? You will not see each other’s posts or comments, and any follows between you are removed.")}</p>
          <div className="flex gap-2"><Button size="sm" variant="danger" loading={pending} onClick={() => run(() => blockAction(userId, true))}>{t("Block")}</Button><Button size="sm" variant="secondary" onClick={() => setConfirmBlock(false)}>{t("Cancel")}</Button></div>
        </div>
      )}
      <ReportButton targetType="user" targetId={userId} label={t("Report profile")} compact />
    </div>
  );
}
