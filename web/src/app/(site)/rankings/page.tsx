import { Medal, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api, apiPage } from "@/lib/api";
import type { RankingRow } from "@/lib/tournaments";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Rankings"), description: tr("Official player rankings from approved tournaments, by season, city and tournament.") };
}

type Params = { season?: string; city?: string; tournament?: string; from?: string; to?: string; page?: string };

export default async function RankingsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const tr = await getT();
  const params = await searchParams;
  const [filters, result] = await Promise.all([
    api<{ seasons: string[]; cities: string[]; tournaments: { slug: string; name: string }[] }>("/rankings/filters").catch(() => ({ seasons: [], cities: [], tournaments: [] })),
    apiPage<RankingRow>("/rankings", { query: { ...params, pageSize: 50 } }).catch(() => null),
  ]);
  const formula = (result?.meta as { pointsFormula?: { placement: Record<string, number>; participation: number; perWin: number } } | undefined)?.pointsFormula;
  const field = "h-10 rounded-md border border-border bg-surface px-3 text-sm";
  const filtered = Boolean(params.season || params.city || params.tournament || params.from || params.to);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid gap-1">
        <h1 className="text-3xl font-bold">{tr("Rankings")}</h1>
        <p className="text-muted">{tr("Points come only from official results in completed, approved tournaments.")}</p>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-4" aria-label={tr("Filter rankings")}>
        <label className="grid gap-1 text-sm">{tr("Season")}<select name="season" defaultValue={params.season ?? ""} className={field}><option value="">{tr("All seasons")}</option>{filters.seasons.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="grid gap-1 text-sm">{tr("City")}<select name="city" defaultValue={params.city ?? ""} className={field}><option value="">{tr("Pakistan (all cities)")}</option>{filters.cities.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="grid gap-1 text-sm">{tr("Tournament")}<select name="tournament" defaultValue={params.tournament ?? ""} className={field}><option value="">{tr("All tournaments")}</option>{filters.tournaments.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select>
        </label>
        <label className="grid gap-1 text-sm">{tr("From")}<input type="date" name="from" defaultValue={params.from} className={field} /></label>
        <label className="grid gap-1 text-sm">{tr("To")}<input type="date" name="to" defaultValue={params.to} className={field} /></label>
        <button className="h-10 rounded-md bg-primary px-4 font-display text-sm font-semibold text-primary-ink hover:bg-primary-hover">{tr("Apply")}</button>
        {filtered && <Link href="/rankings" className="h-10 content-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">{tr("Clear")}</Link>}
      </form>

      {!result && <Alert tone="error">{tr("Rankings could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title={tr("No ranked players yet")} message={filtered ? tr("No results match these filters.") : tr("Rankings appear after the first tournament is completed.")} />
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[760px] text-start text-sm tabular-nums">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("Rank")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("Player")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("City")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Points")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Matches")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Wins")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Win rate")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("Titles")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((r) => (
                  <tr key={r.player.userId} className={r.rank <= 3 ? "bg-primary-soft/50" : ""}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-display font-bold">
                        {r.rank <= 3 && <Medal className="size-4 text-highlight" aria-hidden="true" />}{r.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Link href={`/players/${r.player.userId}`} className="font-medium hover:text-primary">{r.player.name}</Link></td>
                    <td className="px-4 py-3 text-muted">{r.player.city ?? "—"}</td>
                    <td className="px-4 py-3 text-end font-display font-bold">{r.points.toLocaleString("en-PK")}</td>
                    <td className="px-4 py-3 text-end">{r.matches}</td>
                    <td className="px-4 py-3 text-end">{r.wins}</td>
                    <td className="px-4 py-3 text-end">{r.winRate === null ? "—" : `${r.winRate}%`}</td>
                    <td className="px-4 py-3">{r.championships > 0 ? <span className="inline-flex items-center gap-1"><Trophy className="size-4 text-highlight" aria-label={tr("Titles")} />{r.championships}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/rankings" params={{ season: params.season, city: params.city, tournament: params.tournament, from: params.from, to: params.to }} />
        </>
      )}

      {formula && (
        <section aria-labelledby="how-points" className="mt-8 rounded-md border border-border bg-surface p-5 text-sm">
          <h2 id="how-points" className="mb-2 font-display font-semibold">{tr("How points work")}</h2>
          <p className="text-muted">
            {tr("Champion")}{" "}{formula.placement["1"] ?? 0}{tr(", runner-up")}{" "}{formula.placement["2"] ?? 0}{tr(", semi-finalists")}{" "}{formula.placement["3"] ?? 0}{tr(", quarter-finalists")}{" "}{formula.placement["5"] ?? 0} {tr("points. Every player also gets {participation} for taking part and {perWin} per match won on the field (byes and walkovers do not count).", { participation: formula.participation, perWin: formula.perWin })}</p>
        </section>
      )}
    </div>
  );
}
