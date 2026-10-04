import { BadgeCheck, MapPin, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ReportButton } from "@/components/community/report-button";
import { AddToCart, WishlistButton } from "@/components/market/action-buttons";
import { Gallery } from "@/components/market/gallery";
import { Price, ProductGrid, Stars } from "@/components/market/product-card";
import { ShopLogo } from "@/components/market/shop-card";
import { api, ApiError, apiPage } from "@/lib/api";
import { formatDate, type ProductDetail, type Review } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

const getProduct = cache(async (slug: string) => {
  try {
    return await api<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return { title: p.title, description: p.description.slice(0, 160) };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getT();
  const { slug } = await params;
  const p = await getProduct(slug);
  const reviews = await apiPage<Review>(`/products/${encodeURIComponent(slug)}/reviews`, { query: { pageSize: 10 } }).catch(() => null);
  const distribution = (reviews?.meta as { distribution?: Record<string, number> } | undefined)?.distribution;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label={t("Breadcrumb")} className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/marketplace" className="hover:text-primary">{t("Marketplace")}</Link> /</li>
          <li><Link href={`/marketplace?category=${p.category.slug}`} className="hover:text-primary">{p.category.name}</Link> /</li>
          <li aria-current="page" className="text-ink">{p.title}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery images={p.images} title={p.title} />

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <h1 className="text-3xl font-bold">{p.title}</h1>
            <a href="#reviews" className="w-fit"><Stars value={p.ratingAvg} count={p.ratingCount} size="md" /></a>
            {p.compareAtPrice && p.compareAtPrice > p.price && (
              <Price price={p.price} compareAtPrice={p.compareAtPrice} />
            )}
          </div>

          <AddToCart productId={p.id} basePrice={p.price} stock={p.stock} variants={p.variants} />
          <div className="flex flex-wrap items-center gap-4"><WishlistButton productId={p.id} initial={p.isWishlisted} /><ReportButton targetType="product" targetId={p.id} label={t("Report product")} /></div>

          <Link href={`/shops/${p.shop.slug}`} className="flex items-center gap-3 rounded-md border border-border bg-surface p-4 hover:border-primary">
            <ShopLogo shop={p.shop} />
            <div className="grid gap-0.5">
              <span className="flex items-center gap-1 font-display font-semibold">
                {t("Sold by {name}", { name: p.shop.name })}
                {p.shop.isVerified && <BadgeCheck className="size-4 text-info" aria-label={t("Verified shop")} />}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden="true" /> {p.shop.city}</span>
            </div>
          </Link>

          <ul className="grid gap-2 text-sm text-muted">
            <li className="flex gap-2"><Truck className="size-4 shrink-0 text-primary" aria-hidden="true" /> {p.shippingInfo ?? t("Delivery across Pakistan. Shipping fee shown at checkout.")}</li>
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /> {" "}{t("Cancel free of charge until the shop starts preparing your order.")}</li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="desc" className="grid content-start gap-4">
          <h2 id="desc" className="text-xl font-semibold">{t("Description")}</h2>
          <p className="max-w-prose whitespace-pre-line text-ink">{p.description}</p>
          {p.videoUrl && (
            <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{t("Watch product video")}</a>
          )}
        </section>
        {p.specifications.length > 0 && (
          <section aria-labelledby="specs" className="grid content-start gap-4">
            <h2 id="specs" className="text-xl font-semibold">{t("Specifications")}</h2>
            <dl className="divide-y divide-border rounded-md border border-border bg-surface text-sm">
              {p.specifications.map((s) => (
                <div key={s.label} className="grid grid-cols-2 gap-4 px-4 py-3">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <section id="reviews" aria-labelledby="reviews-h" className="mt-12 grid gap-6 scroll-mt-24">
        <h2 id="reviews-h" className="text-xl font-semibold">{t("Reviews")}</h2>
        {!reviews || reviews.data.length === 0 ? (
          <p className="text-muted">{t("No reviews yet. Customers can review this product after their order is delivered.")}</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="grid content-start gap-2">
              <p className="font-display text-4xl font-bold tabular-nums">{p.ratingAvg.toFixed(1)}</p>
              <Stars value={p.ratingAvg} />
              <p className="text-sm text-muted">{t("{ratingCount} reviews", { ratingCount: p.ratingCount })}</p>
              {distribution && (
                <dl className="mt-2 grid gap-1 text-sm">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <dt className="w-10 tabular-nums">{s} ★</dt>
                      <dd className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full bg-highlight" style={{ width: `${((distribution[s] ?? 0) / Math.max(1, p.ratingCount)) * 100}%` }} />
                      </dd>
                      <span className="w-6 text-end text-muted tabular-nums">{distribution[s] ?? 0}</span>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <ul className="divide-y divide-border">
              {reviews.data.map((r) => (
                <li key={r.id} className="grid gap-1 py-4 first:pt-0">
                  <Stars value={r.rating} />
                  {r.comment && <p>{r.comment}</p>}
                  <p className="text-sm text-muted">
                    {r.author.name}{r.author.city ? ` · ${r.author.city}` : ""} · {formatDate(r.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {p.related.length > 0 && (
        <section aria-labelledby="related" className="mt-12 grid gap-4">
          <h2 id="related" className="text-xl font-semibold">{t("More in {name}", { name: p.category.name })}</h2>
          <ProductGrid products={p.related.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}
