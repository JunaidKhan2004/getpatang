import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { AutoSubmitSelect } from "@/components/market/auto-submit-select";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { type EventCard as E, EVENT_TYPE_LABEL, EVENT_TYPES } from "@/lib/events";
import { PAKISTAN_CITIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Events", description: "Kite festivals, exhibitions, workshops and community gatherings across Pakistan." };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ when?: string; type?: string; city?: string; page?: string }> }) {
  const params = await searchParams;
  const result = await apiPage<E>("/events", { query: { ...params, pageSize: 12 } }).catch(() => null);
  const keep = (over: Record<string, string | undefined>) =>
    `/events?${new URLSearchParams(Object.entries({ when: params.when, type: params.type, city: params.city, ...over }).filter((e): e is [string, string] => Boolean(e[1])))}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid gap-1">
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted">Festivals, exhibitions, workshops and gatherings. Every listing carries the organizer’s safety notes.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="When" className="flex gap-1 overflow-x-auto">
          {[{ v: undefined, l: "Upcoming" }, { v: "past", l: "Past" }].map((w) => (
            <Link
              key={w.l}
              href={keep({ when: w.v, page: undefined })}
              aria-current={params.when === w.v ? "page" : undefined}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              {w.l}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-center gap-2">
          {params.when && <input type="hidden" name="when" value={params.when} />}
          <label htmlFor="e-type" className="sr-only">Type</label>
          <AutoSubmitSelect id="e-type" name="type" defaultValue={params.type ?? ""} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">All types</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
          </AutoSubmitSelect>
          <label htmlFor="e-city" className="sr-only">City</label>
          <AutoSubmitSelect id="e-city" name="city" defaultValue={params.city ?? ""} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">All cities</option>
            {PAKISTAN_CITIES.map((c) => <option key={c}>{c}</option>)}
          </AutoSubmitSelect>
        </form>
      </div>

      {!result && <Alert tone="error">Events could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && <EmptyState title="No events here yet" message="Check back soon, or try another city or type." />}
      {result && result.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.data.map((e) => <EventCard key={e.id} e={e} />)}</div>
          <Pagination meta={result.meta} basePath="/events" params={{ when: params.when, type: params.type, city: params.city }} />
        </>
      )}
    </div>
  );
}
