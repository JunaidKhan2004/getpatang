import { CalendarDays, MapPin, ShieldCheck, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EventStatusBadge } from "@/components/events/event-card";
import { Alert, Badge } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { type EventDetail, EVENT_TYPE_LABEL } from "@/lib/events";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { EventRegistrationPanel } from "./registration-panel";
import { getT } from "@/lib/i18n/server";

const getEvent = cache(async (slug: string) => {
  try {
    return await api<EventDetail>(`/events/${encodeURIComponent(slug)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = await getEvent((await params).slug);
  return { title: e.name, description: e.description.slice(0, 160) };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getT();
  const e = await getEvent((await params).slug);

  const fact = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div><dt className="text-xs text-muted">{label}</dt><dd className="font-medium">{value}</dd></div>
    </div>
  );

  return (
    <>
      <section className="kite-pattern relative overflow-hidden bg-maroon-900 text-white">
        {e.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="relative mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6">
          <nav aria-label={t("Breadcrumb")} className="text-sm text-maroon-100"><Link href="/events" className="hover:underline">{t("Events")}</Link> / {t(EVENT_TYPE_LABEL[e.type])}</nav>
          <div className="flex flex-wrap items-center gap-3"><Badge tone="brand">{t(EVENT_TYPE_LABEL[e.type])}</Badge><EventStatusBadge e={e} /><span className="text-sm text-maroon-100">{t("Organised by {organizerName}", { organizerName: e.organizerName })}</span></div>
          <h1 className="max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">{e.name}</h1>
          <p className="flex flex-wrap gap-x-6 gap-y-1 text-maroon-100">
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" aria-hidden="true" />{formatDate(e.startsAt, true)}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="size-4" aria-hidden="true" />{e.venue}, {e.city}</span>
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          {e.status === "CANCELLED" && <Alert tone="error">{t("This event was cancelled")}{e.cancelReason ? `: ${e.cancelReason}` : "."}</Alert>}
          <section className="grid gap-2">
            <h2 className="text-xl font-semibold">{t("About")}</h2>
            <p className="whitespace-pre-line text-ink/90">{e.description}</p>
          </section>
          <section className="grid gap-2 rounded-md border border-border bg-surface p-5" aria-labelledby="safety">
            <h2 id="safety" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-primary" aria-hidden="true" />{t("Safety")}</h2>
            <p className="whitespace-pre-line text-sm">{e.safetyNotes}</p>
          </section>
          {e.rules && (
            <section className="grid gap-2">
              <h2 className="text-xl font-semibold">{t("Rules")}</h2>
              <p className="whitespace-pre-line text-sm text-ink/90">{e.rules}</p>
            </section>
          )}
          {e.tournament && (
            <Link href={`/tournaments/${e.tournament.slug}`} className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 hover:border-primary">
              <Trophy className="size-5 text-primary" aria-hidden="true" />
              <span><span className="block text-xs text-muted">{t("Tournament at this event")}</span><span className="font-semibold">{e.tournament.name}</span></span>
            </Link>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <EventRegistrationPanel e={e} />
          <dl className="grid gap-4 rounded-md border border-border bg-surface p-5">
            {fact(<CalendarDays className="size-4" />, t("When"), <>{formatDate(e.startsAt, true)}{e.endsAt && <> – {formatDate(e.endsAt, true)}</>}</>)}
            {fact(<MapPin className="size-4" />, t("Where"), <>{e.venue}{e.venueAddress && <span className="block text-sm font-normal text-muted">{e.venueAddress}</span>}</>)}
            {fact(<Users className="size-4" />, t("Going"), e.capacity ? t("{attending} of {capacity} places", { attending: e.attending, capacity: e.capacity }) : t("{attending} people", { attending: e.attending }))}
            {fact(<ShieldCheck className="size-4" />, t("Fee"), e.fee ? t("{fee}, paid to the organizer", { fee: formatPKR(e.fee) }) : t("Free"))}
            {e.organizerContact && fact(<Users className="size-4" />, t("Organizer contact"), e.organizerContact)}
          </dl>
        </aside>
      </div>
    </>
  );
}
