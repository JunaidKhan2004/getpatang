import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Pagination } from "@/components/market/pagination";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

export const metadata = { title: "Customers" };

interface CustomerRow {
  name: string;
  city: string | null;
  orders: number;
  spent: number;
  lastOrderAt: string;
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const result = await apiPage<CustomerRow>("/seller/customers", { token: await getAccessToken(), query: { page, pageSize: 25 } }).catch(() => null);

  return (
    <>
      <PageHeader title="Customers" description="People who ordered from your shop, by total spent." />
      {!result && <Alert tone="error">Customers could not load. Please refresh the page.</Alert>}
      {result && result.data.length === 0 && <EmptyState title="No customers yet" message="Customers appear here after their first order." />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">City</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Spent</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {result.data.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted">{c.city ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{c.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPKR(c.spent)}</td>
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
