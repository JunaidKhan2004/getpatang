import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Stars } from "@/components/market/product-card";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reviews") };
}

interface SellerReview {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  author: string;
  product: { title: string; slug: string };
}

export default async function SellerReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const { page } = await searchParams;
  const result = await apiPage<SellerReview>("/seller/reviews", { token: await getAccessToken(), query: { page, pageSize: 20 } }).catch(() => null);
  const meta = result?.meta as { ratingAvg?: number; ratingCount?: number } | undefined;

  return (
    <>
      <PageHeader title={t("Reviews")} description={t("What customers say about your products.")} />
      {!result && <Alert tone="error">{t("Reviews could not load. Please refresh the page.")}</Alert>}
      {result && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <span className="font-display text-3xl font-bold tabular-nums">{(meta?.ratingAvg ?? 0).toFixed(1)}</span>
          <Stars value={meta?.ratingAvg ?? 0} count={meta?.ratingCount ?? 0} size="md" />
        </div>
      )}
      {result && result.data.length === 0 && <EmptyState title={t("No reviews yet")} message={t("Customers can review a product after their order is delivered.")} />}
      {result && result.data.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {result.data.map((r) => (
              <li key={r.id} className="grid gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  {r.isHidden && <Badge>{t("Hidden by moderators")}</Badge>}
                </div>
                {r.comment && <p>{r.comment}</p>}
                <p className="text-sm text-muted">
                  {t("{author} on", { author: r.author })}{" "}<Link href={`/products/${r.product.slug}`} className="text-primary hover:underline">{r.product.title}</Link> · {formatDate(r.createdAt)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} basePath="/seller/reviews" params={{}} />
        </>
      )}
    </>
  );
}
