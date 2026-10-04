import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { type TournamentCard, TOURNAMENT_STATUS_LABEL, type TournamentStatus } from "@/lib/tournaments";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Tournaments") };
}

const TABS: (TournamentStatus | undefined)[] = [undefined, "DRAFT", "PUBLISHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default async function AdminTournamentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const tr = await getT();
  const params = await searchParams;
  const result = await apiPage<TournamentCard>("/admin/tournaments", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title={tr("Tournaments")} description={tr("Create events, manage players, draw brackets and run matches.")} actions={<ButtonLink href="/admin/tournaments/new">{tr("New tournament")}</ButtonLink>} />
      {!result && <Alert tone="error">{tr("Tournaments could not load. You may not have permission to manage tournaments.")}</Alert>}
      {result && (
        <>
          <nav aria-label={tr("Status")} className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map((s) => (
              <Link key={s ?? "all"} href={s ? `/admin/tournaments?status=${s}` : "/admin/tournaments"} aria-current={params.status === s ? "page" : undefined} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                {s ? tr(TOURNAMENT_STATUS_LABEL[s]) : tr("All")} ({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})
              </Link>
            ))}
          </nav>
          {result.data.length === 0 ? (
            <EmptyState title={tr("No tournaments")} message={tr("Create a draft, add the permit reference and publish it.")} action={<ButtonLink href="/admin/tournaments/new">{tr("New tournament")}</ButtonLink>} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-border bg-surface">
                <table className="w-full min-w-[720px] text-start text-sm">
                  <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                    <tr><th className="px-4 py-3 font-semibold">{tr("Tournament")}</th><th className="px-4 py-3 font-semibold">{tr("Starts")}</th><th className="px-4 py-3 font-semibold">{tr("Status")}</th><th className="px-4 py-3 text-end font-semibold">{tr("Players")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.data.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-2">
                        <td className="px-4 py-3"><Link href={`/admin/tournaments/${t.id}`} className="font-medium text-primary hover:underline">{t.name}</Link><div className="text-xs text-muted">{tr("{venue}, {city} · season {season}", { venue: t.venue, city: t.city, season: t.season })}</div></td>
                        <td className="px-4 py-3 text-muted">{formatDate(t.startsAt, true)}</td>
                        <td className="px-4 py-3"><Badge tone={t.status === "IN_PROGRESS" ? "danger" : t.status === "PUBLISHED" ? "info" : t.status === "COMPLETED" ? "success" : "neutral"}>{tr(TOURNAMENT_STATUS_LABEL[t.status])}</Badge></td>
                        <td className="px-4 py-3 text-end tabular-nums">{t.registeredCount} / {t.maxParticipants}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={result.meta} basePath="/admin/tournaments" params={{ status: params.status }} />
            </>
          )}
        </>
      )}
    </>
  );
}
