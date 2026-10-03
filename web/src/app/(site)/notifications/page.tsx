import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import type { NotificationItem } from "@/lib/notifications";
import { getAccessToken, requireUser } from "@/lib/session";

import { MarkAllRead, NotificationRow } from "./notification-row";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; page?: string }> }) {
  await requireUser("/notifications");
  const params = await searchParams;
  const result = await apiPage<NotificationItem>("/notifications", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const unread = (result?.meta as { unread?: number } | undefined)?.unread ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex items-center gap-2">
          {unread > 0 && <MarkAllRead />}
          <ButtonLink href="/account/notifications" variant="ghost" size="sm">Settings</ButtonLink>
        </div>
      </div>
      <nav aria-label="Filter" className="mb-4 flex gap-1">
        {[{ v: undefined, l: "All" }, { v: "true", l: `Unread (${unread})` }].map((f) => (
          <Link
            key={f.l}
            href={f.v ? "/notifications?unread=true" : "/notifications"}
            aria-current={params.unread === f.v ? "page" : undefined}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {f.l}
          </Link>
        ))}
      </nav>
      {!result && <Alert tone="error">Notifications could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title={params.unread ? "You're all caught up" : "No notifications yet"} message="Order, payment, tournament and community updates will appear here." />
      )}
      {result && result.data.length > 0 && (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {result.data.map((n) => <NotificationRow key={n.id} n={n} />)}
          </ul>
          <Pagination meta={result.meta} basePath="/notifications" params={{ unread: params.unread }} />
        </>
      )}
    </div>
  );
}
