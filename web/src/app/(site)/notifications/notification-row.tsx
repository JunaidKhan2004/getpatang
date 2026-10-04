"use client";

import { Bell, CalendarDays, CreditCard, MessageCircle, Package, Palette, Store, Trophy, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { markAllReadAction, markReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { type NotificationItem } from "@/lib/notifications";
import { useT, useFormat } from "@/lib/i18n/client";

const ICONS: Record<string, LucideIcon> = {
  orders: Package,
  payments: CreditCard,
  shop: Store,
  custom_orders: Palette,
  tournaments: Trophy,
  events: CalendarDays,
  community: MessageCircle,
};

export function NotificationRow({ n }: { n: NotificationItem }) {
  const { timeAgo } = useFormat();
  const t = useT();
  const router = useRouter();
  const [read, setRead] = useState(Boolean(n.readAt));
  const [now] = useState(() => Date.now());
  const Icon = ICONS[n.category] ?? Bell;

  const open = async () => {
    if (!read) {
      setRead(true);
      void markReadAction(n.id);
    }
    if (n.link) router.push(n.link);
  };

  return (
    <li>
      <button type="button" onClick={open} className={`flex w-full gap-3 px-4 py-3 text-start hover:bg-surface-2 ${read ? "" : "bg-primary-soft/50"}`}>
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={`text-sm ${read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
          <span className="text-sm text-muted">{n.body}</span>
          <span className="text-xs text-muted">{timeAgo(n.createdAt, now)}</span>
        </span>
        {!read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label={t("Unread")} />}
      </button>
    </li>
  );
}

export function MarkAllRead() {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await markAllReadAction();
          if (res.ok) {
            toast.success(res.message);
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      {t("Mark all as read")}</Button>
  );
}
