import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { type AdminEvent, EVENT_STATUS_LABEL } from "@/lib/events";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { EventForm } from "../event-form";
import { EventCommands } from "./event-commands";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Manage event") };
}

export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  let e: AdminEvent;
  try {
    e = await api<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const active = e.registrations.filter((r) => r.status !== "CANCELLED");

  return (
    <>
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/admin/events" className="hover:text-primary">{t("Events")}</Link> / {e.name}</nav>
      <PageHeader
        title={e.name}
        description={`${e.venue}, ${e.city} · ${formatDate(e.startsAt, true)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={e.status === "PUBLISHED" ? "info" : e.status === "CANCELLED" ? "danger" : "neutral"}>{t(EVENT_STATUS_LABEL[e.status])}</Badge>
            {e.status !== "DRAFT" && <Link href={`/events/${e.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">{t("Public page")}</Link>}
            <EventCommands id={e.id} status={e.status} />
          </div>
        }
      />
      {e.status === "CANCELLED" && <div className="mb-6"><Alert tone="error">{t("Cancelled: {cancelReason}", { cancelReason: e.cancelReason })}</Alert></div>}

      <section className="mb-8 grid gap-3" aria-labelledby="regs">
        <h2 id="regs" className="text-lg font-semibold">{t("Registrations · {attending} going", { attending: e.attending })}{e.capacity ? ` of ${e.capacity}` : ""}</h2>
        {active.length === 0 ? (
          <EmptyState title={t("No registrations yet")} message={e.registrationRequired ? t("People who register appear here.") : t("This event does not need registration.")} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[640px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr><th className="px-4 py-3 font-semibold">{t("Name")}</th><th className="px-4 py-3 font-semibold">{t("Contact")}</th><th className="px-4 py-3 font-semibold">{t("Guests")}</th><th className="px-4 py-3 font-semibold">{t("Status")}</th><th className="px-4 py-3 font-semibold">{t("Registered")}</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-muted">{[r.user.phone, r.user.email].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-3 tabular-nums">{r.guests}</td>
                    <td className="px-4 py-3"><Badge tone={r.status === "CONFIRMED" ? "success" : "warning"}>{r.status === "CONFIRMED" ? t("Confirmed") : t("Waiting list")}</Badge></td>
                    <td className="px-4 py-3 text-muted">{formatDate(r.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(e.status === "DRAFT" || e.status === "PUBLISHED") && (
        <section aria-labelledby="details" className="grid gap-3">
          <h2 id="details" className="text-lg font-semibold">{t("Details")}</h2>
          <EventForm initial={e} />
        </section>
      )}
    </>
  );
}
