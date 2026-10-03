import type { Metadata } from "next";
import Link from "next/link";

import { AutoSubmitSelect } from "@/components/market/auto-submit-select";
import { Pagination } from "@/components/market/pagination";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import type { TournamentCard as T } from "@/lib/tournaments";
import { PAKISTAN_CITIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Tournaments", description: "Approved kite-flying tournaments across Pakistan: register, follow brackets and results." };

const VIEWS = [
  { value: "", label: "All" },
  { value: "open", label: "Registration open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Results" },
];

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ view?: string; city?: string; page?: string; q?: string }> }) {
  const params = await searchParams;
  const result = await apiPage<T>("/tournaments", { query: { ...params, pageSize: 12 } }).catch(() => null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid gap-1">
        <h1 className="text-3xl font-bold">Tournaments</h1>
        <p className="text-muted">Every event listed here has a local permit and published safety rules.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Tournament view" className="flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={`/tournaments?${new URLSearchParams({ ...(v.value && { view: v.value }), ...(params.city && { city: params.city }) })}`}
              aria-current={(params.view ?? "") === v.value ? "page" : undefined}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-2">
          {params.view && <input type="hidden" name="view" value={params.view} />}
          <label htmlFor="t-city" className="text-sm">City</label>
          <AutoSubmitSelect id="t-city" name="city" defaultValue={params.city ?? ""} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">All cities</option>
            {PAKISTAN_CITIES.map((c) => <option key={c}>{c}</option>)}
          </AutoSubmitSelect>
        </form>
      </div>

      {!result && <Alert tone="error">Tournaments could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && <EmptyState title="No tournaments here yet" message="Check back soon, or try another city or view." />}
      {result && result.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.data.map((t) => <TournamentCard key={t.id} t={t} />)}</div>
          <Pagination meta={result.meta} basePath="/tournaments" params={{ view: params.view, city: params.city }} />
        </>
      )}
    </div>
  );
}
