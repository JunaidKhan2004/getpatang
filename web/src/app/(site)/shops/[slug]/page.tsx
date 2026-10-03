import { BadgeCheck, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ReportButton } from "@/components/community/report-button";
import { FollowButton } from "@/components/market/action-buttons";
import { Pagination } from "@/components/market/pagination";
import { ProductGrid, Stars } from "@/components/market/product-card";
import { ShopLogo } from "@/components/market/shop-card";
import { EmptyState } from "@/components/ui/feedback";
import { api, ApiError, apiPage } from "@/lib/api";
import { formatDate, type ProductCard, type Review, type ShopDetail } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

const getShop = cache(async (slug: string) => {
  try {
    return await api<ShopDetail>(`/shops/${encodeURIComponent(slug)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const shop = await getShop((await params).slug);
  return { title: shop.name, description: shop.description ?? `Kites and accessories from ${shop.name}, ${shop.city}.` };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; page?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const { tab = "products", page, sort } = await searchParams;
  const shop = await getShop(slug);

  const products = tab === "products" ? await apiPage<ProductCard>("/products", { query: { shop: slug, page, sort, pageSize: 24 } }).catch(() => null) : null;
  const reviews = tab === "reviews" ? await apiPage<Review>(`/shops/${slug}/reviews`, { query: { page, pageSize: 20 } }).catch(() => null) : null;

  const tabLink = (t: string) =>
    `rounded-md px-4 py-2 text-sm font-medium ${tab === t ? "bg-primary-soft text-primary" : "text-muted hover:text-ink"}`;

  return (
    <>
      <div className="kite-pattern h-36 bg-maroon-900 sm:h-48">
        {shop.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface p-5">
          <ShopLogo shop={shop} size="lg" />
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {shop.name}
              {shop.isVerified && <BadgeCheck className="size-5 text-info" aria-label="Verified shop" />}
            </h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{shop.city}</span>
              <Stars value={shop.ratingAvg} count={shop.ratingCount} />
              <span>{shop.productCount} products</span>
            </p>
          </div>
          <FollowButton shopSlug={shop.slug} initial={shop.isFollowing} initialCount={shop.followerCount} />
        </div>

        <div className="grid gap-8 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid content-start gap-4 rounded-md border border-border bg-surface p-5 text-sm">
            <h2 className="font-display text-base font-semibold">About</h2>
            <p className="text-muted">{shop.description ?? "This shop has not added a description yet."}</p>
            <ul className="grid gap-2">
              {shop.address && <li className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />{shop.address}</li>}
              {shop.phone && <li className="flex gap-2"><Phone className="size-4 shrink-0 text-primary" aria-hidden="true" /><a href={`tel:${shop.phone}`} className="hover:underline">{shop.phone}</a></li>}
              {shop.email && <li className="flex gap-2"><Mail className="size-4 shrink-0 text-primary" aria-hidden="true" /><a href={`mailto:${shop.email}`} className="break-all hover:underline">{shop.email}</a></li>}
            </ul>
            <p className="text-xs text-muted">On Kite Platform since {formatDate(shop.createdAt)}</p>
            <ReportButton targetType="shop" targetId={shop.id} label="Report shop" />
          </aside>

          <section className="min-w-0">
            <nav aria-label="Shop sections" className="mb-5 flex gap-2">
              <Link href={`/shops/${slug}`} className={tabLink("products")} aria-current={tab === "products" ? "page" : undefined}>Products</Link>
              <Link href={`/shops/${slug}?tab=reviews`} className={tabLink("reviews")} aria-current={tab === "reviews" ? "page" : undefined}>Reviews ({shop.ratingCount})</Link>
            </nav>

            {tab === "products" && products && (
              products.data.length ? (
                <>
                  <ProductGrid products={products.data} />
                  <Pagination meta={products.meta} basePath={`/shops/${slug}`} params={{ sort }} />
                </>
              ) : (
                <EmptyState title="No products yet" message="This shop has not listed any products yet." />
              )
            )}

            {tab === "reviews" && reviews && (
              reviews.data.length ? (
                <>
                  <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                    {reviews.data.map((r) => (
                      <li key={r.id} className="grid gap-1 p-4">
                        <Stars value={r.rating} />
                        {r.comment && <p>{r.comment}</p>}
                        <p className="text-sm text-muted">
                          {r.author.name} on <Link href={`/products/${r.product!.slug}`} className="text-primary hover:underline">{r.product!.title}</Link> · {formatDate(r.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <Pagination meta={reviews.meta} basePath={`/shops/${slug}`} params={{ tab: "reviews" }} />
                </>
              ) : (
                <EmptyState title="No reviews yet" message="Reviews appear after customers receive their orders." />
              )
            )}
          </section>
        </div>
      </div>
    </>
  );
}
