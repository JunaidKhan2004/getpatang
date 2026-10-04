import type { Metadata } from "next";

import { AutoSubmitSelect } from "@/components/market/auto-submit-select";
import { Pagination } from "@/components/market/pagination";
import { ShopCard } from "@/components/market/shop-card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import type { ShopCard as Shop } from "@/lib/market";
import { PAKISTAN_CITIES } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Shops"), description: t("Independent kite shops from across Pakistan.") };
}

type Params = { q?: string; city?: string; sort?: string; page?: string };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getT();
  const params = await searchParams;
  const result = await apiPage<Shop>("/shops", { query: { ...params, pageSize: 24 } }).catch(() => null);
  const field = "h-11 rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid gap-1">
        <h1 className="text-3xl font-bold">{t("Shops")}</h1>
        <p className="text-muted">{t("Follow your favourite kite shops to hear about new stock first.")}</p>
      </div>

      <form role="search" className="mb-6 flex flex-wrap gap-3">
        <label htmlFor="shop-q" className="sr-only">{t("Search shops")}</label>
        <input id="shop-q" name="q" defaultValue={params.q} placeholder={t("Search shops")} className={`${field} min-w-0 flex-1 basis-60`} />
        <label htmlFor="shop-city" className="sr-only">{t("City")}</label>
        <AutoSubmitSelect id="shop-city" name="city" defaultValue={params.city ?? ""} className={field}>
          <option value="">{t("All cities")}</option>
          {PAKISTAN_CITIES.map((c) => <option key={c}>{c}</option>)}
        </AutoSubmitSelect>
        <label htmlFor="shop-sort" className="sr-only">{t("Sort shops")}</label>
        <AutoSubmitSelect id="shop-sort" name="sort" defaultValue={params.sort ?? "popular"} className={field}>
          <option value="popular">{t("Most followed")}</option>
          <option value="rating">{t("Top rated")}</option>
          <option value="newest">{t("Newest")}</option>
        </AutoSubmitSelect>
        <button className="h-11 rounded-md bg-primary px-5 font-display text-sm font-semibold text-primary-ink hover:bg-primary-hover">{t("Search")}</button>
      </form>

      {!result && <Alert tone="error">{t("We could not load shops right now. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("No shops found")} message={t("Try another city or search term.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.map((s) => <ShopCard key={s.id} shop={s} />)}
          </div>
          <Pagination meta={result.meta} basePath="/shops" params={params} />
        </>
      )}
    </div>
  );
}
