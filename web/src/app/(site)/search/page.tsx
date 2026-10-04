import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/market/product-card";
import { ShopCard } from "@/components/market/shop-card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { ProductCard, ShopCard as Shop } from "@/lib/market";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Search") };
}

interface SearchResult {
  query: string;
  products: ProductCard[];
  shops: Shop[];
  categories: { name: string; slug: string }[];
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const q = ((await searchParams).q ?? "").trim();
  const result = q.length >= 2 ? await api<SearchResult>("/search", { query: { q } }).catch(() => null) : null;
  const empty = result && !result.products.length && !result.shops.length && !result.categories.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <form role="search" className="mb-8 flex gap-2">
        <label htmlFor="global-q" className="sr-only">{t("Search kites, shops and categories")}</label>
        <input
          id="global-q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          minLength={2}
          placeholder={t("Search kites, shops and categories")}
          className="h-12 min-w-0 flex-1 rounded-md border border-border bg-surface px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button className="h-12 rounded-md bg-primary px-6 font-display font-semibold text-primary-ink hover:bg-primary-hover">{t("Search")}</button>
      </form>

      {!q && <p className="text-muted">{t("Type at least 2 characters to search products, shops and categories.")}</p>}
      {q && q.length < 2 && <Alert>{t("Type at least 2 characters to search.")}</Alert>}
      {q.length >= 2 && !result && <Alert tone="error">{t("Search is not available right now. Please try again.")}</Alert>}
      {empty && <EmptyState title={t("Nothing found for “{q}”", { q })} message={t("Check the spelling or try a more general word, like “kite” or “string”.")} />}

      {result && !empty && (
        <div className="grid gap-10">
          {result.categories.length > 0 && (
            <section aria-labelledby="s-cats" className="grid gap-3">
              <h2 id="s-cats" className="text-lg font-semibold">{t("Categories")}</h2>
              <div className="flex flex-wrap gap-2">
                {result.categories.map((c) => (
                  <Link key={c.slug} href={`/marketplace?category=${c.slug}`} className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium hover:border-primary hover:text-primary">
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {result.shops.length > 0 && (
            <section aria-labelledby="s-shops" className="grid gap-3">
              <h2 id="s-shops" className="text-lg font-semibold">{t("Shops")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.shops.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
            </section>
          )}
          {result.products.length > 0 && (
            <section aria-labelledby="s-products" className="grid gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="s-products" className="text-lg font-semibold">{t("Products")}</h2>
                <Link href={`/marketplace?q=${encodeURIComponent(q)}`} className="text-sm font-semibold text-primary hover:underline">{t("See all with filters")}</Link>
              </div>
              <ProductGrid products={result.products} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
