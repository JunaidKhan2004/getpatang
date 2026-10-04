import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { type EventCard, EVENT_STATUS_LABEL, EVENT_TYPE_LABEL, type EventStatus } from "@/lib/events";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Events") };
}

const TABS: (EventStatus | undefined)[] = [undefined, "DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"];
const TONE: Record<EventStatus, "neutral" | "info" | "success" | "danger"> = { DRAFT: "neutral", PUBLISHED: "info", COMPLETED: "success", CANCELLED: "danger" };

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const result = await apiPage<EventCard>("/admin/events", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);

  return (
    <>
      <PageHeader title={t("Events")} description={t("Festivals, exhibitions, workshops and gatherings.")} actions={<ButtonLink href="/admin/events/new">{t("New event")}</ButtonLink>} />
      {!result && <Alert tone="error">{t("Events could not load. You may not have permission to manage events.")}</Alert>}
      {result && (
        <>
          <nav aria-label={t("Status")} className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map((s) => (
              <Link key={s ?? "all"} href={s ? `/admin/events?status=${s}` : "/admin/events"} aria-current={params.status === s ? "page" : undefined} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                {s ? t(EVENT_STATUS_LABEL[s]) : t("All")}
              </Link>
            ))}
          </nav>
          {result.data.length === 0 ? (
            <EmptyState title={t("No events")} message={t("Create a draft, check the safety notes and publish it.")} action={<ButtonLink href="/admin/events/new">{t("New event")}</ButtonLink>} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border bg-surface">
                <table className="w-full min-w-[720px] text-start text-sm">
                  <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                    <tr><th className="px-4 py-3 font-semibold">{t("Event")}</th><th className="px-4 py-3 font-semibold">{t("Starts")}</th><th className="px-4 py-3 font-semibold">{t("Status")}</th><th className="px-4 py-3 text-end font-semibold">{t("Going")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.data.map((e) => (
                      <tr key={e.id} className="hover:bg-surface-2">
                        <td className="px-4 py-3"><Link href={`/admin/events/${e.id}`} className="font-medium text-primary hover:underline">{e.name}</Link><div className="text-xs text-muted">{t(EVENT_TYPE_LABEL[e.type])} · {e.venue}, {e.city}</div></td>
                        <td className="px-4 py-3 text-muted">{formatDate(e.startsAt, true)}</td>
                        <td className="px-4 py-3"><Badge tone={TONE[e.status]}>{t(EVENT_STATUS_LABEL[e.status])}</Badge></td>
                        <td className="px-4 py-3 text-end tabular-nums">{e.capacity ? `${e.attending} / ${e.capacity}` : e.attending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={result.meta} basePath="/admin/events" params={{ status: params.status }} />
            </>
          )}
        </>
      )}
    </>
  );
}
