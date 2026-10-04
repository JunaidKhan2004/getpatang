import { SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AutoSubmitSelect } from "@/components/market/auto-submit-select";
import { Pagination } from "@/components/market/pagination";
import { ProductGrid } from "@/components/market/product-card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api, apiPage } from "@/lib/api";
import type { Category, ProductCard } from "@/lib/market";
import { PAKISTAN_CITIES } from "@/lib/validation";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
  title: t("Marketplace"),
  description: t("Kites, charkhis, cotton string and accessories from verified shops across Pakistan."),
};
}

type Params = {
  q?: string;
  category?: string;
  city?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  inStock?: string;
  sort?: string;
  page?: string;
};

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const input =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getT();
  const params = await searchParams;
  const [categories, result] = await Promise.all([
    api<Category[]>("/categories").catch(() => [] as Category[]),
    apiPage<ProductCard>("/products", { query: { ...params, pageSize: 24 } }).catch(() => null),
  ]);

  const active = categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === params.category);
  const hasFilters = Boolean(params.q || params.category || params.city || params.minPrice || params.maxPrice || params.minRating || params.inStock);

  const filters = (
    <form className="grid gap-6" aria-label={t("Filter products")}>
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}

      <fieldset className="grid gap-1.5">
        <legend className="mb-2 font-display text-sm font-semibold">{t("Category")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="category" value="" defaultChecked={!params.category} className="accent-[var(--primary)]" />
          {t("All categories")}</label>
        {categories.map((c) => (
          <div key={c.id} className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="category" value={c.slug} defaultChecked={params.category === c.slug} className="accent-[var(--primary)]" />
              {c.name} <span className="text-muted">({c.productCount + c.children.reduce((n, ch) => n + ch.productCount, 0)})</span>
            </label>
            {c.children.map((ch) => (
              <label key={ch.id} className="ms-6 flex items-center gap-2 text-sm">
                <input type="radio" name="category" value={ch.slug} defaultChecked={params.category === ch.slug} className="accent-[var(--primary)]" />
                {ch.name} <span className="text-muted">({ch.productCount})</span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 font-display text-sm font-semibold">{t("Price (Rs)")}</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="minPrice">{t("Minimum price")}</label>
          <input id="minPrice" name="minPrice" type="number" min={0} inputMode="numeric" placeholder={t("Min")} defaultValue={params.minPrice} className={input} />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="maxPrice">{t("Maximum price")}</label>
          <input id="maxPrice" name="maxPrice" type="number" min={0} inputMode="numeric" placeholder={t("Max")} defaultValue={params.maxPrice} className={input} />
        </div>
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor="minRating" className="font-display text-sm font-semibold">{t("Rating")}</label>
        <select id="minRating" name="minRating" defaultValue={params.minRating ?? ""} className={input}>
          <option value="">{t("Any rating")}</option>
          <option value="4">{t("4 stars & up")}</option>
          <option value="3">{t("3 stars & up")}</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label htmlFor="city" className="font-display text-sm font-semibold">{t("Shop location")}</label>
        <select id="city" name="city" defaultValue={params.city ?? ""} className={input}>
          <option value="">{t("All cities")}</option>
          {PAKISTAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="inStock" value="true" defaultChecked={params.inStock === "true"} className="size-4 accent-[var(--primary)]" />
        {t("In stock only")}</label>

      <div className="flex gap-2">
        <button className="h-10 flex-1 rounded-md bg-primary font-display text-sm font-semibold text-primary-ink hover:bg-primary-hover">{t("Apply filters")}</button>
        {hasFilters && (
          <Link href="/marketplace" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">
            {t("Clear")}</Link>
        )}
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 grid gap-1">
        <h1 className="text-3xl font-bold">{active ? active.name : params.q ? t("Results for “{q}”", { q: params.q }) : t("Marketplace")}</h1>
        <p className="text-muted">{active?.description ?? t("Kites and accessories from verified shops across Pakistan.")}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <details className="group rounded-md border border-border bg-surface lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
              <SlidersHorizontal className="size-4" aria-hidden="true" /> {" "}{t("Filters")}</summary>
            <div className="border-t border-border p-4">{filters}</div>
          </details>
          <div className="hidden rounded-md border border-border bg-surface p-5 lg:block">{filters}</div>
        </aside>

        <section aria-label={t("Products")} className="min-w-0">
          <form className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {Object.entries(params)
              .filter(([k, v]) => v && k !== "sort" && k !== "page")
              .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <p className="text-sm text-muted" aria-live="polite">
              {result ? `${result.meta.total} ${result.meta.total === 1 ? "product" : "products"}` : ""}
            </p>
            <label className="flex items-center gap-2 text-sm">
              {t("Sort by")}<AutoSubmitSelect name="sort" defaultValue={params.sort ?? "newest"} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
              </AutoSubmitSelect>
            </label>
          </form>

          {!result && <Alert tone="error">{t("We could not load products right now. Please refresh the page.")}</Alert>}
          {result && result.data.length === 0 && (
            <EmptyState
              title={t("No products found")}
              message={hasFilters ? t("Try removing a filter or searching for something else.") : t("Shops have not listed products yet.")}
              action={hasFilters ? <Link href="/marketplace" className="font-semibold text-primary hover:underline">{t("Clear all filters")}</Link> : undefined}
            />
          )}
          {result && result.data.length > 0 && (
            <>
              <ProductGrid products={result.data} />
              <Pagination meta={result.meta} basePath="/marketplace" params={params} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
