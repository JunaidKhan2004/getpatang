import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Customers") };
}

interface CustomerRow {
  name: string;
  city: string | null;
  orders: number;
  spent: number;
  lastOrderAt: string;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const { page } = await searchParams;
  const result = await apiPage<CustomerRow>("/seller/customers", { token: await getAccessToken(), query: { page, pageSize: 25 } }).catch(() => null);

  return (
    <>
      <PageHeader title={t("Customers")} description={t("People who ordered from your shop, by total spent.")} />
      {!result && <Alert tone="error">{t("Customers could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("No customers yet")} message={t("Customers appear here after their first order.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[560px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Customer")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("City")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{t("Orders")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-semibold">{t("Spent")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Last order")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {result.data.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted">{c.city ?? "—"}</td>
                    <td className="px-4 py-3 text-end">{c.orders}</td>
                    <td className="px-4 py-3 text-end font-semibold">{formatPKR(c.spent)}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(c.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/seller/customers" params={{}} />
        </>
      )}
    </>
  );
}
