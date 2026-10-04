import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { DailyBarChart } from "@/components/seller/bar-chart";
import { RangeSwitch, Stat } from "@/components/seller/stat";
import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/market";
import type { Dashboard } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Analytics") };
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const tr = await getT();
  const raw = (await searchParams).days;
  const days = ["7", "30", "90"].includes(raw ?? "") ? Number(raw) : 90;
  const d = await api<Dashboard>("/seller/dashboard", { token: await getAccessToken(), query: { days } }).catch(() => null);
  if (!d) return <Alert tone="error">{tr("Analytics could not load. Please refresh the page.")}</Alert>;
  const t = d.totals;

  return (
    <>
      <PageHeader title={tr("Analytics")} description={tr("Sales and orders over the last {days} days.", { days })} actions={<RangeSwitch days={days} basePath="/seller/analytics" />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Sales")} value={formatPKR(t.periodRevenue)} />
        <Stat label={tr("Orders")} value={String(t.periodOrders)} />
        <Stat label={tr("Average order")} value={formatPKR(t.averageOrderValue)} />
        <Stat label={tr("Customers")} value={String(t.periodCustomers)} />
      </div>

      {/* Two measures with different scales get two charts, never one chart with two axes. */}
      <section aria-labelledby="a-sales" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-sales" className="mb-2 font-display font-semibold">{tr("Sales per day")}</h2>
        <DailyBarChart points={d.series.map((s) => ({ date: s.date, value: s.revenue }))} label={tr("Sales")} kind="currency" />
      </section>
      <section aria-labelledby="a-orders" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-orders" className="mb-2 font-display font-semibold">{tr("Orders per day")}</h2>
        <DailyBarChart points={d.series.map((s) => ({ date: s.date, value: s.orders }))} label={tr("Orders")} kind="count" />
      </section>

      <section aria-labelledby="a-top" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-top" className="mb-3 font-display font-semibold">{tr("Best-selling products")}</h2>
        {d.topProducts.length === 0 ? (
          <p className="text-sm text-muted">{tr("No sales in this period.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-start text-sm tabular-nums">
              <thead className="text-xs tracking-wide text-muted uppercase"><tr><th className="py-2 font-semibold">{tr("Product")}</th><th className="py-2 text-end font-semibold">{tr("Units")}</th><th className="py-2 text-end font-semibold">{tr("Sales")}</th></tr></thead>
              <tbody className="divide-y divide-border">
                {d.topProducts.map((p, i) => (
                  <tr key={p.id ?? i}><td className="py-2">{p.title ?? tr("Deleted product")}</td><td className="py-2 text-end">{p.unitsSold}</td><td className="py-2 text-end font-semibold">{formatPKR(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
