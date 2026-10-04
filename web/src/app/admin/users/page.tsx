import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { AutoSubmitSelect } from "@/components/market/auto-submit-select";
import { Pagination } from "@/components/market/pagination";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import { ROLE_LABEL, USER_STATUS_TONE } from "@/lib/admin";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import type { PublicUser } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Users") };
}

const STATUSES = [undefined, "ACTIVE", "SUSPENDED", "BANNED"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; role?: string; page?: string }> }) {
  const t = await getT();
  const params = await searchParams;
  const result = await apiPage<PublicUser>("/admin/users", { token: await getAccessToken(), query: { ...params, pageSize: 20 } }).catch(() => null);
  const counts = (result?.meta as { statusCounts?: Record<string, number> } | undefined)?.statusCounts ?? {};
  const link = (over: Record<string, string | undefined>) =>
    `/admin/users?${new URLSearchParams(Object.entries({ q: params.q, status: params.status, role: params.role, ...over }).filter((e): e is [string, string] => Boolean(e[1])))}`;

  return (
    <>
      <PageHeader title={t("Users")} description={t("Accounts, roles and access. Suspending someone signs them out everywhere.")} />

      <nav aria-label={t("Status")} className="mb-4 flex gap-1 overflow-x-auto">
        {STATUSES.map((s) => (
          <Link
            key={s ?? "all"}
            href={link({ status: s, page: undefined })}
            aria-current={params.status === s ? "page" : undefined}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {s ? s.charAt(0) + s.slice(1).toLowerCase() : t("All")}
            {s && ` (${counts[s] ?? 0})`}
          </Link>
        ))}
      </nav>

      <form role="search" className="mb-4 flex flex-wrap gap-2">
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <label htmlFor="q" className="sr-only">{t("Search users")}</label>
        <input id="q" name="q" defaultValue={params.q} placeholder={t("Name, email or phone")} className="h-10 w-72 rounded-md border border-border bg-surface px-3 text-sm" />
        <label htmlFor="role" className="sr-only">{t("Role")}</label>
        <AutoSubmitSelect id="role" name="role" defaultValue={params.role ?? ""} className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
          <option value="">{t("All roles")}</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </AutoSubmitSelect>
      </form>

      {!result && <Alert tone="error">{t("Users could not load. You may not have permission to view accounts.")}</Alert>}
      {result && result.data.length === 0 && <EmptyState title={t("No matching users")} message={t("Try another search or filter.")} />}
      {result && result.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Name")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Contact")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Roles")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("Joined")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.data.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">{u.fullName}</Link>
                      {u.profile?.city && <div className="text-xs text-muted">{u.profile.city}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted"><div>{u.email}</div>{u.phone && <div>{u.phone}</div>}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} tone="brand">{t(ROLE_LABEL[r]) ?? r}</Badge>)}</div></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={USER_STATUS_TONE[u.status]}>{u.status.toLowerCase()}</Badge>
                        {!u.isVerified && <Badge tone="warning">{t("unverified")}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={result.meta} basePath="/admin/users" params={{ q: params.q, status: params.status, role: params.role }} />
        </>
      )}
    </>
  );
}
