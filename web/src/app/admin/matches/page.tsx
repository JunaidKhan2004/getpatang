import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import type { MatchView } from "@/lib/tournaments";

import { OfficialMatch } from "./official-match";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Matches") };
}

export default async function OfficialMatchesPage({ searchParams }: { searchParams: Promise<{ all?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const result = await apiPage<MatchView>("/officials/matches", { token: await getAccessToken(), query: { all: params.all, page: params.page, pageSize: 20 } }).catch(() => null);

  return (
    <>
      <PageHeader title={t("Matches")} description={t("Run your assigned matches: check players in, start, and record the official result.")} />
      <nav aria-label={t("Which matches")} className="mb-4 flex gap-1">
        <Link href="/admin/matches" aria-current={!params.all ? "page" : undefined} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">{t("Assigned to me")}</Link>
        <Link href="/admin/matches?all=true" aria-current={params.all ? "page" : undefined} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">{t("All open matches (managers)")}</Link>
      </nav>
      {!result && <Alert tone="error">{t("Matches could not load. This page is for match officials and tournament managers.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("No open matches")} message={t("Matches assigned to you appear here when a tournament is in progress.")} />}
      {result && result.data.length > 0 && (
        <>
          <ul className="grid gap-4">{result.data.map((m) => <OfficialMatch key={m.id} m={m} />)}</ul>
          <Pagination meta={result.meta} basePath="/admin/matches" params={{ all: params.all }} />
        </>
      )}
    </>
  );
}
