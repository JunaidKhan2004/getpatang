import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Stars } from "@/components/market/product-card";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Reviews" };

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
  const { page } = await searchParams;
  const result = await apiPage<SellerReview>("/seller/reviews", { token: await getAccessToken(), query: { page, pageSize: 20 } }).catch(() => null);
  const meta = result?.meta as { ratingAvg?: number; ratingCount?: number } | undefined;

  return (
    <>
      <PageHeader title="Reviews" description="What customers say about your products." />
      {!result && <Alert tone="error">Reviews could not load. Please refresh the page.</Alert>}
      {result && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <span className="font-display text-3xl font-bold tabular-nums">{(meta?.ratingAvg ?? 0).toFixed(1)}</span>
          <Stars value={meta?.ratingAvg ?? 0} count={meta?.ratingCount ?? 0} size="md" />
        </div>
      )}
      {result && result.data.length === 0 && <EmptyState title="No reviews yet" message="Customers can review a product after their order is delivered." />}
      {result && result.data.length > 0 && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {result.data.map((r) => (
              <li key={r.id} className="grid gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  {r.isHidden && <Badge>Hidden by moderators</Badge>}
                </div>
                {r.comment && <p>{r.comment}</p>}
                <p className="text-sm text-muted">
                  {r.author} on <Link href={`/products/${r.product.slug}`} className="text-primary hover:underline">{r.product.title}</Link> · {formatDate(r.createdAt)}
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
