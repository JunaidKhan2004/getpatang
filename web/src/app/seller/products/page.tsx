import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { ProductImage } from "@/components/market/product-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatPKR } from "@/lib/market";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE, type ProductStatus, type SellerProduct } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductRowActions } from "./row-actions";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Products") };
}

const TABS: { status?: ProductStatus; label: string }[] = [
  { label: "All" },
  { status: "ACTIVE", label: "Live" },
  { status: "PENDING_APPROVAL", label: "Waiting" },
  { status: "DRAFT", label: "Drafts" },
  { status: "HIDDEN", label: "Paused" },
  { status: "REJECTED", label: "Rejected" },
];

export default async function SellerProductsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; lowStock?: string }> }) {
  const tr = await getT();
  const params = await searchParams;
  const result = await apiPage<SellerProduct>("/seller/products", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title={tr("Products")} description={tr("Everything you sell, with stock and approval status.")} actions={<ButtonLink href="/seller/products/new">{tr("Add product")}</ButtonLink>} />

      <nav aria-label={tr("Product status")} className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = (params.status ?? "") === (t.status ?? "") && !params.lowStock;
          const n = t.status ? counts[t.status] : Object.entries(counts).filter(([k]) => k !== "REMOVED").reduce((a, [, v]) => a + v, 0);
          return (
            <Link
              key={t.label}
              href={t.status ? `/seller/products?status=${t.status}` : "/seller/products"}
              aria-current={active ? "page" : undefined}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
            >
              {tr(t.label)} <span className="tabular-nums">({n ?? 0})</span>
            </Link>
          );
        })}
        <Link href="/seller/products?lowStock=true" aria-current={params.lowStock ? "page" : undefined} className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-warning aria-[current=page]:bg-primary-soft">
          {tr("Low stock")}</Link>
      </nav>

      <form role="search" className="mb-4 flex max-w-md gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <label htmlFor="pq" className="sr-only">{tr("Search products")}</label>
        <input id="pq" name="q" defaultValue={params.q} placeholder={tr("Search by title or SKU")} className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm" />
        <button className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">{tr("Search")}</button>
      </form>

      {!result && <Alert tone="error">{tr("Products could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState title={tr("No products here")} message={params.status || params.q || params.lowStock ? tr("Try another tab or search.") : tr("Add your first product to start selling.")} action={<ButtonLink href="/seller/products/new">{tr("Add product")}</ButtonLink>} />
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("Product")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{tr("Status")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Price")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Stock")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{tr("Sold")}</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">{tr("Actions")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((p) => (
                  <tr key={p.id} className="align-middle">
                    <td className="px-4 py-3">
                      <Link href={`/seller/products/${p.id}`} className="flex items-center gap-3 hover:text-primary">
                        <ProductImage image={p.images[0] ?? null} title={p.title} className="size-11 shrink-0 rounded" />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium">{p.title}{p.isFeatured && <span className="ms-2 text-xs text-highlight">{tr("Featured")}</span>}</span>
                          <span className="text-xs text-muted">{p.category.name}{p.variants.length > 0 && tr("· {variants} options", { variants: p.variants.length })}</span>
                        </span>
                      </Link>
                      {p.status === "REJECTED" && p.reviewNote && <p className="mt-1 text-xs text-danger">{tr("Reason: {reviewNote}", { reviewNote: p.reviewNote })}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge tone={PRODUCT_STATUS_TONE[p.status]}>{tr(PRODUCT_STATUS_LABEL[p.status])}</Badge></td>
                    <td className="px-4 py-3 text-end tabular-nums">{formatPKR(p.price)}</td>
                    <td className={`px-4 py-3 text-end tabular-nums ${p.isLowStock ? "font-semibold text-warning" : ""}`}>{p.stock}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-muted">{p.salesCount}</td>
                    <td className="px-4 py-3 text-end"><ProductRowActions product={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/seller/products" params={{ status: params.status, q: params.q, lowStock: params.lowStock }} />
        </>
      )}
    </>
  );
}
