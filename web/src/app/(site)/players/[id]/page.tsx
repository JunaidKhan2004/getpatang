import { Award, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Badge, EmptyState } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { type PlayerProfile, placementLabel } from "@/lib/tournaments";

const getPlayer = cache(async (id: string) => {
  try {
    return await api<PlayerProfile>(`/players/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPlayer((await params).id);
  return { title: p.player.name };
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPlayer((await params).id);
  const s = p.stats;
  const stat = (label: string, value: string | number) => (
    <div className="grid gap-0.5 rounded-md border border-border bg-surface p-4"><span className="text-xs text-muted">{label}</span><span className="font-display text-2xl font-bold tabular-nums">{value}</span></div>
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center gap-5">
        <span className="inline-flex size-20 items-center justify-center rounded-full bg-primary font-display text-3xl font-bold text-primary-ink">{p.player.name.charAt(0).toUpperCase()}</span>
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold">{p.player.name}</h1>
          <p className="flex flex-wrap items-center gap-3 text-muted">
            {p.player.city && <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{p.player.city}</span>}
            <span>Member since {formatDate(p.player.memberSince)}</span>
          </p>
          {p.player.bio && <p className="max-w-prose">{p.player.bio}</p>}
        </div>
      </header>

      <section aria-label="Statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Overall rank", s.rank ? `#${s.rank}` : "Unranked")}
        {stat("Points", s.points)}
        {stat("Tournaments", s.tournaments)}
        {stat("Titles", s.championships)}
        {stat("Matches", s.matches)}
        {stat("Wins", s.wins)}
        {stat("Losses", s.losses)}
        {stat("Win rate", s.winRate === null ? "—" : `${s.winRate}%`)}
      </section>

      <section aria-labelledby="badges" className="grid gap-3">
        <h2 id="badges" className="text-xl font-semibold">Badges</h2>
        {p.badges.length === 0 ? (
          <p className="text-muted">Badges are earned by playing in and winning tournaments.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {p.badges.map((b) => (
              <li key={b.key} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2" title={b.description}>
                <Award className="size-5 text-highlight" aria-hidden="true" />
                <span><span className="block font-semibold">{b.label}</span><span className="text-xs text-muted">{b.description}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.upcoming.length > 0 && (
        <section aria-labelledby="upcoming" className="grid gap-3">
          <h2 id="upcoming" className="text-xl font-semibold">Playing in</h2>
          <ul className="grid gap-2">
            {p.upcoming.map((t) => (
              <li key={t.slug}><Link href={`/tournaments/${t.slug}`} className="font-medium text-primary hover:underline">{t.name}</Link> <span className="text-sm text-muted">· {t.city} · {formatDate(t.startsAt)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="text-xl font-semibold">Tournament results</h2>
        {p.results.length === 0 ? (
          <EmptyState title="No results yet" message="Results appear after a completed tournament." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase"><tr><th className="px-4 py-3 font-semibold">Tournament</th><th className="px-4 py-3 font-semibold">Finish</th><th className="px-4 py-3 text-right font-semibold">W–L</th><th className="px-4 py-3 text-right font-semibold">Points</th></tr></thead>
              <tbody className="divide-y divide-border">
                {p.results.map((r) => (
                  <tr key={r.tournament.slug}>
                    <td className="px-4 py-3"><Link href={`/tournaments/${r.tournament.slug}`} className="font-medium hover:text-primary">{r.tournament.name}</Link><div className="text-xs text-muted">{r.tournament.city} · {formatDate(r.tournament.startsAt)}</div></td>
                    <td className="px-4 py-3"><Badge tone={r.placement === 1 ? "success" : r.placement <= 3 ? "brand" : "neutral"}>{placementLabel(r.placement)}</Badge></td>
                    <td className="px-4 py-3 text-right">{r.wins}–{r.losses}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {p.recentMatches.length > 0 && (
        <section aria-labelledby="matches" className="grid gap-3">
          <h2 id="matches" className="text-xl font-semibold">Recent matches</h2>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {p.recentMatches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <Badge tone={m.won ? "success" : "danger"}>{m.won ? "Won" : "Lost"}</Badge>{" "}
                  vs {m.opponent ? <Link href={`/players/${m.opponent.userId}`} className="font-medium hover:text-primary">{m.opponent.name}</Link> : "—"}
                  {m.isWalkover && <span className="text-muted"> (walkover)</span>}
                </span>
                <span className="text-muted"><Link href={`/tournaments/${m.tournament.slug}`} className="hover:text-primary">{m.tournament.name}</Link></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
