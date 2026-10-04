import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Stat } from "@/components/seller/stat";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Earnings") };
}

interface EarningRow {
  orderNumber: string;
  total: number;
  commission: number;
  net: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveredAt: string;
}
interface Summary {
  commissionPercent: number;
  grossSales: number;
  commission: number;
  netEarnings: number;
  deliveredOrders: number;
  inProgressAmount: number;
  inProgressOrders: number;
}

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const { page } = await searchParams;
  const result = await apiPage<EarningRow>("/seller/earnings", { token: await getAccessToken(), query: { page, pageSize: 20 } }).catch(() => null);
  if (!result) return <Alert tone="error">{t("Earnings could not load. Please refresh the page.")}</Alert>;
  const s = (result.meta as unknown as { summary: Summary }).summary;

  return (
    <>
      <PageHeader title={t("Earnings")} description={t("What your shop has earned from delivered orders.")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Delivered sales")} value={formatPKR(s.grossSales)} sub={`${s.deliveredOrders} orders`} />
        <Stat label={t("Platform commission ({commissionPercent}%)", { commissionPercent: s.commissionPercent })} value={formatPKR(s.commission)} />
        <Stat label={t("Your earnings")} value={formatPKR(s.netEarnings)} />
        <Stat label={t("On the way")} value={formatPKR(s.inProgressAmount)} sub={`${s.inProgressOrders} orders not delivered yet`} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {t("Cash-on-delivery money is collected by your courier. Automatic payouts to your account arrive in a later update; until then this page is your statement.")}</p>

      <section aria-labelledby="statement" className="mt-6">
        <h2 id="statement" className="mb-3 font-display font-semibold">{t("Statement")}</h2>
        {result.data.length === 0 ? (
          <EmptyState title={t("No delivered orders yet")} message={t("Earnings appear here when you mark orders as delivered.")} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border bg-surface">
              <table className="w-full min-w-[640px] text-start text-sm">
                <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("Order")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("Delivered")}</th>
                    <th scope="col" className="px-4 py-3 text-end font-semibold">{t("Order total")}</th>
                    <th scope="col" className="px-4 py-3 text-end font-semibold">{t("Commission")}</th>
                    <th scope="col" className="px-4 py-3 text-end font-semibold">{t("You earn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {result.data.map((r) => (
                    <tr key={r.orderNumber}>
                      <td className="px-4 py-3 font-medium">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(r.deliveredAt)}</td>
                      <td className="px-4 py-3 text-end">{formatPKR(r.total)}</td>
                      <td className="px-4 py-3 text-end text-muted">−{formatPKR(r.commission)}</td>
                      <td className="px-4 py-3 text-end font-semibold">{formatPKR(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={result.meta} basePath="/seller/earnings" params={{}} />
          </>
        )}
      </section>
    </>
  );
}
