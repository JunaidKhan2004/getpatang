import { CalendarDays, MapPin, ShieldCheck, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BracketView, MatchCard } from "@/components/tournaments/bracket-view";
import { DisputeButton } from "@/components/tournaments/dispute-button";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-card";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { type MatchView, type Participant, placementLabel, type TournamentDetail } from "@/lib/tournaments";

import { RegistrationPanel } from "./registration-panel";

const getTournament = cache(async (slug: string) => {
  try {
    return await api<TournamentDetail>(`/tournaments/${encodeURIComponent(slug)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = await getTournament((await params).slug);
  return { title: t.name, description: t.description.slice(0, 160) };
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "bracket", label: "Bracket" },
  { key: "schedule", label: "Schedule" },
];

export default async function TournamentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const requested = (await searchParams).tab;
  const tab = TABS.some((t) => t.key === requested) ? requested! : "overview";
  const t = await getTournament(slug);

  const [participants, bracket, schedule] = await Promise.all([
    tab === "players" ? api<Participant[]>(`/tournaments/${slug}/participants`).catch(() => []) : Promise.resolve(null),
    tab === "bracket" ? api<{ rounds: { round: number; name: string; matches: MatchView[] }[] }>(`/tournaments/${slug}/bracket`).catch(() => ({ rounds: [] })) : Promise.resolve(null),
    tab === "schedule" || (tab === "overview" && t.status === "IN_PROGRESS") ? api<MatchView[]>(`/tournaments/${slug}/schedule`).catch(() => []) : Promise.resolve(null),
  ]);
  const live = schedule?.filter((m) => m.status === "LIVE") ?? [];

  const fact = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div><dt className="text-xs text-muted">{label}</dt><dd className="font-medium">{value}</dd></div>
    </div>
  );

  return (
    <>
      <section className="kite-pattern relative overflow-hidden bg-maroon-900 text-white">
        {t.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="relative mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-maroon-100"><Link href="/tournaments" className="hover:underline">Tournaments</Link> / {t.season}</nav>
          <div className="flex flex-wrap items-center gap-3"><TournamentStatusBadge t={t} /><span className="text-sm text-maroon-100">Organised by {t.organizerName}</span></div>
          <h1 className="max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">{t.name}</h1>
          <p className="flex flex-wrap gap-x-6 gap-y-1 text-maroon-100">
            <span className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />{formatDate(t.startsAt, true)}</span>
            <span className="flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" />{t.venue}, {t.city}</span>
          </p>
          {t.champion && (
            <p className="flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5" aria-hidden="true" /> Champion: <Link href={`/players/${t.champion.userId}`} className="underline">{t.champion.name}</Link></p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {t.status === "CANCELLED" && <div className="mb-6"><Alert tone="error">This tournament was cancelled. {t.cancelReason}</Alert></div>}

        <nav aria-label="Tournament sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((x) => (
            <Link
              key={x.key}
              href={x.key === "overview" ? `/tournaments/${slug}` : `/tournaments/${slug}?tab=${x.key}`}
              aria-current={tab === x.key ? "page" : undefined}
              className="-mb-px shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted hover:text-ink aria-[current=page]:border-primary aria-[current=page]:text-primary"
            >
              {x.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {tab === "overview" && (
              <div className="grid gap-8">
                {live.length > 0 && (
                  <section aria-labelledby="live-now" className="grid gap-3">
                    <h2 id="live-now" className="text-xl font-semibold text-danger">● Live now</h2>
                    <div className="flex flex-wrap gap-4">{live.map((m) => <MatchCard key={m.id} m={m} />)}</div>
                  </section>
                )}
                <section aria-labelledby="about" className="grid gap-2">
                  <h2 id="about" className="text-xl font-semibold">About</h2>
                  <p className="max-w-prose whitespace-pre-line">{t.description}</p>
                  {t.prizeInfo && <p className="flex gap-2 font-medium"><Trophy className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{t.prizeInfo}</p>}
                </section>
                <section aria-labelledby="rules" className="grid gap-2">
                  <h2 id="rules" className="text-xl font-semibold">Rules</h2>
                  <p className="max-w-prose whitespace-pre-line">{t.rules}</p>
                </section>
                <section aria-labelledby="safety" className="grid gap-3 rounded-md border border-primary/30 bg-primary-soft p-5">
                  <h2 id="safety" className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Safety and eligibility</h2>
                  <dl className="grid gap-3 text-sm">
                    <div><dt className="font-semibold">Safety rules</dt><dd className="whitespace-pre-line">{t.safetyRules}</dd></div>
                    <div><dt className="font-semibold">Approved materials</dt><dd>{t.approvedMaterials}</dd></div>
                    {t.venueRestrictions && <div><dt className="font-semibold">Venue restrictions</dt><dd>{t.venueRestrictions}</dd></div>}
                    <div><dt className="font-semibold">Minimum age</dt><dd>{t.minAge} years on the day of the tournament</dd></div>
                    {t.permitReference && <div><dt className="font-semibold">Local permission</dt><dd>Reference {t.permitReference}</dd></div>}
                  </dl>
                </section>
              </div>
            )}

            {tab === "players" && participants && (
              participants.length === 0 ? (
                <EmptyState title="No confirmed players yet" message="Confirmed players appear here." />
              ) : (
                <ol className="divide-y divide-border rounded-md border border-border bg-surface">
                  {participants.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-6 text-right text-sm text-muted tabular-nums">{i + 1}</span>
                        <Link href={`/players/${p.player.userId}`} className="truncate font-medium hover:text-primary">{p.player.name}</Link>
                        {p.player.city && <span className="text-sm text-muted">{p.player.city}</span>}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        {p.seed && <Badge>Seed {p.seed}</Badge>}
                        {p.finalPlacement && <Badge tone={p.finalPlacement === 1 ? "success" : "brand"}>{placementLabel(p.finalPlacement)}</Badge>}
                        {p.status === "DISQUALIFIED" && <Badge tone="danger">Disqualified</Badge>}
                      </span>
                    </li>
                  ))}
                </ol>
              )
            )}

            {tab === "bracket" && bracket && <BracketView rounds={bracket.rounds} />}

            {tab === "schedule" && schedule && (
              schedule.length === 0 ? (
                <EmptyState title="No matches yet" message="The schedule appears once the bracket is drawn." />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border bg-surface">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                      <tr><th className="px-4 py-3 font-semibold">Match</th><th className="px-4 py-3 font-semibold">Players</th><th className="px-4 py-3 font-semibold">When / where</th><th className="px-4 py-3 font-semibold">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {schedule.map((m) => (
                        <tr key={m.id}>
                          <td className="px-4 py-3"><div className="font-medium">#{m.matchNumber}</div><div className="text-xs text-muted">{m.roundName}</div></td>
                          <td className="px-4 py-3">
                            <span className={m.winnerId === m.playerA?.participantId ? "font-semibold" : ""}>{m.playerA?.name ?? "TBD"}</span>
                            <span className="text-muted"> vs </span>
                            <span className={m.winnerId === m.playerB?.participantId ? "font-semibold" : ""}>{m.playerB?.name ?? "TBD"}</span>
                            {m.scoreA !== null && <span className="ml-2 text-muted tabular-nums">({m.scoreA}–{m.scoreB})</span>}
                          </td>
                          <td className="px-4 py-3 text-muted">{m.scheduledAt ? formatDate(m.scheduledAt, true) : "Not scheduled"}{m.location && ` · ${m.location}`}</td>
                          <td className="px-4 py-3">
                            <Badge tone={m.status === "LIVE" ? "danger" : m.status === "COMPLETED" ? "success" : m.status === "DISPUTED" ? "warning" : "neutral"}>{m.status === "LIVE" ? "● Live" : m.status.replace("_", "-").toLowerCase()}</Badge>
                            {t.myEntry && (m.playerA?.participantId === t.myEntry.id || m.playerB?.participantId === t.myEntry.id) && (m.status === "LIVE" || m.status === "COMPLETED") && (
                              <div className="mt-1"><DisputeButton matchId={m.id} slug={slug} /></div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          <aside className="grid content-start gap-4">
            <RegistrationPanel t={t} />
            <dl className="grid gap-4 rounded-md border border-border bg-surface p-5 text-sm">
              {fact(<CalendarDays className="size-4" />, "Starts", formatDate(t.startsAt, true))}
              {fact(<CalendarDays className="size-4" />, "Registration", `${formatDate(t.registrationOpensAt)} – ${formatDate(t.registrationClosesAt, true)}`)}
              {fact(<MapPin className="size-4" />, "Venue", <>{t.venue}{t.venueAddress && <span className="block font-normal text-muted">{t.venueAddress}</span>}</>)}
              {fact(<Users className="size-4" />, "Players", `${t.registeredCount} of ${t.maxParticipants}${t.waitlistedCount ? ` · ${t.waitlistedCount} waiting` : ""}`)}
              {fact(<Trophy className="size-4" />, "Entry fee", t.entryFee ? formatPKR(t.entryFee) : "Free")}
              {t.organizerContact && fact(<ShieldCheck className="size-4" />, "Organizer contact", t.organizerContact)}
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
