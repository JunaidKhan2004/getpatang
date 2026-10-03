import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { DailyBarChart } from "@/components/seller/bar-chart";
import { RangeSwitch, Stat } from "@/components/seller/stat";
import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/market";
import type { Dashboard } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const raw = (await searchParams).days;
  const days = ["7", "30", "90"].includes(raw ?? "") ? Number(raw) : 90;
  const d = await api<Dashboard>("/seller/dashboard", { token: await getAccessToken(), query: { days } }).catch(() => null);
  if (!d) return <Alert tone="error">Analytics could not load. Please refresh the page.</Alert>;
  const t = d.totals;

  return (
    <>
      <PageHeader title="Analytics" description={`Sales and orders over the last ${days} days.`} actions={<RangeSwitch days={days} basePath="/seller/analytics" />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={formatPKR(t.periodRevenue)} />
        <Stat label="Orders" value={String(t.periodOrders)} />
        <Stat label="Average order" value={formatPKR(t.averageOrderValue)} />
        <Stat label="Customers" value={String(t.periodCustomers)} />
      </div>

      {/* Two measures with different scales get two charts, never one chart with two axes. */}
      <section aria-labelledby="a-sales" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-sales" className="mb-2 font-display font-semibold">Sales per day</h2>
        <DailyBarChart points={d.series.map((s) => ({ date: s.date, value: s.revenue }))} label="Sales" kind="currency" />
      </section>
      <section aria-labelledby="a-orders" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-orders" className="mb-2 font-display font-semibold">Orders per day</h2>
        <DailyBarChart points={d.series.map((s) => ({ date: s.date, value: s.orders }))} label="Orders" kind="count" />
      </section>

      <section aria-labelledby="a-top" className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 id="a-top" className="mb-3 font-display font-semibold">Best-selling products</h2>
        {d.topProducts.length === 0 ? (
          <p className="text-sm text-muted">No sales in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
              <thead className="text-xs tracking-wide text-muted uppercase"><tr><th className="py-2 font-semibold">Product</th><th className="py-2 text-right font-semibold">Units</th><th className="py-2 text-right font-semibold">Sales</th></tr></thead>
              <tbody className="divide-y divide-border">
                {d.topProducts.map((p, i) => (
                  <tr key={p.id ?? i}><td className="py-2">{p.title ?? "Deleted product"}</td><td className="py-2 text-right">{p.unitsSold}</td><td className="py-2 text-right font-semibold">{formatPKR(p.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
