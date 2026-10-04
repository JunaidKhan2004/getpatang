import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/market/pagination";
import { ProductGrid } from "@/components/market/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import type { ProductCard } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Wishlist") };
}

export default async function WishlistPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  await requireUser("/account/wishlist");
  const { page } = await searchParams;
  const result = await apiPage<ProductCard & { isAvailable: boolean }>("/wishlist", { token: await getAccessToken(), query: { page, pageSize: 24 } }).catch(() => null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label={t("Breadcrumb")} className="mb-4 text-sm text-muted"><Link href="/account" className="hover:text-primary">{t("My account")}</Link> / Wishlist</nav>
      <h1 className="mb-6 text-3xl font-bold">{t("Wishlist")}</h1>
      {!result && <Alert tone="error">{t("We could not load your wishlist. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title={t("Nothing saved yet")} message={t("Tap “Save to wishlist” on any product to keep it here.")} action={<ButtonLink href="/marketplace">{t("Browse the marketplace")}</ButtonLink>} />
      )}
      {result && result.data.length > 0 && (
        <>
          <ProductGrid products={result.data.filter((p) => p.isAvailable)} />
          {result.data.some((p) => !p.isAvailable) && (
            <p className="mt-4 text-sm text-muted">{t("Some saved products are no longer sold and are hidden.")}</p>
          )}
          <Pagination meta={result.meta} basePath="/account/wishlist" params={{}} />
        </>
      )}
    </div>
  );
}
