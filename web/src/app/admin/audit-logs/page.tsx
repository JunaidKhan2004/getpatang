import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import type { AuditRow } from "@/lib/admin";
import { apiPage } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Audit logs") };
}

const AREAS = ["auth.", "user.", "seller.", "product.", "order.", "payment.", "refund.", "tournament.", "match.", "event.", "moderation.", "setting.", "content."];

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ action?: string; q?: string; actorId?: string; entityId?: string; from?: string; to?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const query = {
    ...params,
    from: params.from ? new Date(`${params.from}T00:00:00+05:00`).toISOString() : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59+05:00`).toISOString() : undefined,
    pageSize: 50,
  };
  const result = await apiPage<AuditRow>("/admin/audit-logs", { token: await getAccessToken(), query }).catch(() => null);
  const input = "h-10 rounded-md border border-border bg-surface px-3 text-sm";

  return (
    <>
      <PageHeader title={t("Audit logs")} description={t("Every sign-in and staff or member action that changes data. Kept for review and disputes.")} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        {params.actorId && <input type="hidden" name="actorId" value={params.actorId} />}
        <label className="grid gap-1 text-xs text-muted">
          {t("Area")}<select name="action" defaultValue={params.action ?? ""} className={input}>
            <option value="">{t("All")}</option>
            {AREAS.map((a) => <option key={a} value={a}>{a.replace(".", "")}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">{t("Person")}<input name="q" defaultValue={params.q} placeholder={t("Name or email")} className={input} /></label>
        <label className="grid gap-1 text-xs text-muted">{t("From")}<input type="date" name="from" defaultValue={params.from} className={input} /></label>
        <label className="grid gap-1 text-xs text-muted">{t("To")}<input type="date" name="to" defaultValue={params.to} className={input} /></label>
        <button className="h-10 rounded-md bg-primary px-4 font-display text-sm font-semibold text-primary-ink hover:bg-primary-hover">{t("Filter")}</button>
        {(params.actorId || params.entityId) && <Link href="/admin/audit-logs" className="h-10 content-center text-sm text-primary hover:underline">{t("Clear person filter")}</Link>}
      </form>

      {!result && <Alert tone="error">{t("Audit logs could not load. You may not have permission to read them.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("Nothing recorded")} message={t("No actions match these filters.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[860px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("When")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Who")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Action")}</th>
                  <th className="px-4 py-3 font-semibold">{t("On")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Details")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {result.data.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(l.createdAt, true)}</td>
                    <td className="px-4 py-3">
                      {l.actor ? <Link href={`/admin/users/${l.actor.id}`} className="text-primary hover:underline">{l.actor.fullName}</Link> : <span className="text-muted">{t("System")}</span>}
                      {l.ipAddress && <div className="text-xs text-muted">{l.ipAddress}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                    <td className="px-4 py-3 text-xs">{l.entityType}{l.entityId && <div className="font-mono text-muted">{l.entityId}</div>}</td>
                    <td className="max-w-md px-4 py-3">
                      {l.metadata ? <pre className="overflow-x-auto text-xs whitespace-pre-wrap text-muted">{JSON.stringify(l.metadata, null, 1).slice(0, 600)}</pre> : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/admin/audit-logs" params={{ action: params.action, q: params.q, actorId: params.actorId, from: params.from, to: params.to }} />
        </>
      )}
    </>
  );
}
