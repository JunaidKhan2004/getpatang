import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { ProductImage } from "@/components/market/product-card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { PRODUCT_STATUS_LABEL, type ProductStatus } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductModeration } from "./product-moderation";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Products") };
}

interface ModerationRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ProductStatus;
  price: number;
  stock: number;
  updatedAt: string;
  reviewNote: string | null;
  images: { url: string }[];
  variants: { name: string; price: number | null; stock: number }[];
  category: { name: string };
  shop: { id: string; name: string };
}

const TABS: ProductStatus[] = ["PENDING_APPROVAL", "ACTIVE", "HIDDEN", "REJECTED", "REMOVED"];

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const status = (params.status as ProductStatus | undefined) ?? "PENDING_APPROVAL";
  const result = await apiPage<ModerationRow>("/admin/products", { token: await getAccessToken(), query: { status, q: params.q, page: params.page, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title={t("Products")} description={t("Approve new listings and act on reported or unsafe products.")} />
      <nav aria-label={t("Product status")} className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <Link key={s} href={`/admin/products?status=${s}`} aria-current={status === s ? "page" : undefined} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
            {t(PRODUCT_STATUS_LABEL[s])} <span className="tabular-nums">({counts[s] ?? 0})</span>
          </Link>
        ))}
      </nav>
      <form role="search" className="mb-4 flex max-w-md gap-2">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="mq" className="sr-only">{t("Search products")}</label>
        <input id="mq" name="q" defaultValue={params.q} placeholder={t("Product title or shop name")} className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm" />
        <button className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">{t("Search")}</button>
      </form>

      {!result && <Alert tone="error">{t("Products could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("Nothing to review")} message={status === "PENDING_APPROVAL" ? t("The approval queue is empty.") : t("No products with this status.")} />}
      {result && result.data.length > 0 && (
        <>
          <ul className="grid gap-4">
            {result.data.map((p) => (
              <li key={p.id} className="grid gap-4 rounded-md border border-border bg-surface p-4 md:grid-cols-[120px_minmax(0,1fr)_260px]">
                <div className="flex gap-2 md:grid">
                  {(p.images.length ? p.images.slice(0, 2) : [null]).map((img, i) => (
                    <ProductImage key={i} image={img ? { url: img.url, alt: p.title } : null} title={p.title} className="size-24 rounded md:size-28" />
                  ))}
                </div>
                <div className="grid min-w-0 content-start gap-1 text-sm">
                  <span className="font-display text-base font-semibold">{p.title}</span>
                  <span className="text-muted">
                    <Link href={`/admin/sellers/${p.shop.id}`} className="text-primary hover:underline">{p.shop.name}</Link> {" "}{t("· {name} · updated {true}", { name: p.category.name, true: formatDate(p.updatedAt, true) })}
                  </span>
                  <span className="tabular-nums">{formatPKR(p.price)} · {p.variants.length ? `${p.variants.length} options (${p.variants.map((v) => v.name).join(", ")})` : `${p.stock} in stock`}</span>
                  <p className="mt-1 line-clamp-4 whitespace-pre-line text-muted">{p.description}</p>
                  {p.reviewNote && <p className="text-danger">{t("Note: {reviewNote}", { reviewNote: p.reviewNote })}</p>}
                </div>
                <ProductModeration productId={p.id} status={p.status} slug={p.slug} />
              </li>
            ))}
          </ul>
          <Pagination meta={result.meta} basePath="/admin/products" params={{ status, q: params.q }} />
        </>
      )}
    </>
  );
}
