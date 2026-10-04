import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { SHOP_STATUS_LABEL, SHOP_STATUS_TONE, type ShopStatus } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sellers") };
}

interface AdminShopRow {
  id: string;
  name: string;
  city: string;
  status: ShopStatus;
  isVerified: boolean;
  submittedAt: string | null;
  createdAt: string;
  owner: { fullName: string; email: string };
  _count: { products: number; orders: number };
}

const TABS: (ShopStatus | undefined)[] = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "SUSPENDED", undefined];

export default async function AdminSellersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const status = params.status === "ALL" ? undefined : ((params.status as ShopStatus | undefined) ?? "PENDING");
  const result = await apiPage<AdminShopRow>("/admin/shops", { token: await getAccessToken(), query: { status, q: params.q, page: params.page, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};

  return (
    <>
      <PageHeader title={t("Sellers")} description={t("Review applications, approve shops and act on problems.")} />
      <nav aria-label={t("Seller status")} className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <Link
            key={s ?? "ALL"}
            href={`/admin/sellers?status=${s ?? "ALL"}`}
            aria-current={status === s ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {s ? t(SHOP_STATUS_LABEL[s]) : t("All")} <span className="tabular-nums">({s ? (counts[s] ?? 0) : Object.values(counts).reduce((a, b) => a + b, 0)})</span>
          </Link>
        ))}
      </nav>
      <form role="search" className="mb-4 flex max-w-md gap-2">
        <input type="hidden" name="status" value={status ?? "ALL"} />
        <label htmlFor="sq" className="sr-only">{t("Search sellers")}</label>
        <input id="sq" name="q" defaultValue={params.q} placeholder={t("Shop name, city or owner email")} className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm" />
        <button className="h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-2">{t("Search")}</button>
      </form>

      {!result && <Alert tone="error">{t("Sellers could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("Nothing here")} message={status === "PENDING" ? t("No applications are waiting. Nice work.") : t("No shops match this filter.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[720px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Shop")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Owner")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Submitted")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{t("Products / orders")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/admin/sellers/${s.id}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                      <div className="text-xs text-muted">{s.city}{s.isVerified && t("· verified")}</div>
                    </td>
                    <td className="px-4 py-3"><div>{s.owner.fullName}</div><div className="text-xs text-muted">{s.owner.email}</div></td>
                    <td className="px-4 py-3"><Badge tone={SHOP_STATUS_TONE[s.status]}>{t(SHOP_STATUS_LABEL[s.status])}</Badge></td>
                    <td className="px-4 py-3 text-muted">{s.submittedAt ? formatDate(s.submittedAt, true) : "—"}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{s._count.products} / {s._count.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/admin/sellers" params={{ status: status ?? "ALL", q: params.q }} />
        </>
      )}
    </>
  );
}
