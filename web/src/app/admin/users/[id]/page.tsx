import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/feedback";
import { type AdminUserDetail, ROLE_LABEL, type RoleInfo, USER_STATUS_TONE } from "@/lib/admin";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatPKR } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

import { RolesEditor, StatusActions } from "./user-actions";

export const metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  const me = await requireUser(`/admin/users/${id}`);
  let u: AdminUserDetail;
  try {
    u = await api<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const perms = me.permissions ?? [];
  const roles = perms.includes("roles.manage") ? await api<RoleInfo[]>("/admin/roles", { token }).catch(() => []) : [];
  const isSelf = me.id === u.id;
  const fact = (label: string, value: React.ReactNode) => (
    <div className="grid gap-0.5"><dt className="text-xs text-muted">{label}</dt><dd className="font-medium">{value}</dd></div>
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/admin/users" className="hover:text-primary">Users</Link> / {u.fullName}</nav>
      <PageHeader
        title={u.fullName}
        description={[u.email, u.phone].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-1">
            <Badge tone={USER_STATUS_TONE[u.status]}>{u.status.toLowerCase()}</Badge>
            {u.roles.map((r) => <Badge key={r} tone="brand">{ROLE_LABEL[r] ?? r}</Badge>)}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section className="rounded-md border border-border bg-surface p-5" aria-labelledby="overview">
            <h2 id="overview" className="mb-4 font-display font-semibold">Overview</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              {fact("Joined", formatDate(u.createdAt))}
              {fact("Last sign-in", u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "Never")}
              {fact("Signed-in devices", u.counts.activeSessions)}
              {fact("Orders", u.counts.orders)}
              {fact("Delivered spend", formatPKR(u.deliveredSpend))}
              {fact("Reviews", u.counts.reviews)}
              {fact("Posts", u.counts.posts)}
              {fact("Tournament entries", u.counts.tournamentEntries)}
              {fact("Reports filed / against", `${u.counts.reportsFiled} / ${u.counts.reportsAgainst}`)}
              {fact("City", u.profile?.city ?? "—")}
              {fact("Email verified", u.isVerified ? "Yes" : "No")}
              {u.shop && fact("Shop", <Link href={`/admin/sellers/${u.shop.id}`} className="text-primary hover:underline">{u.shop.name} ({u.shop.status.toLowerCase()})</Link>)}
            </dl>
            <p className="mt-4 text-sm"><Link href={`/community/u/${u.id}`} target="_blank" className="font-semibold text-primary hover:underline">Public profile</Link></p>
          </section>

          <section className="rounded-md border border-border bg-surface p-5" aria-labelledby="history">
            <h2 id="history" className="mb-3 font-display font-semibold">Recent activity</h2>
            {u.history.length === 0 ? (
              <p className="text-sm text-muted">No recorded activity.</p>
            ) : (
              <ol className="grid gap-2 text-sm">
                {u.history.map((h, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
                    <span>
                      <span className="font-mono text-xs">{h.action}</span>
                      {h.actor && h.actor.id !== u.id && <span className="text-muted"> by {h.actor.fullName}</span>}
                      {typeof (h.metadata as { reason?: string } | null)?.reason === "string" && <span className="text-muted"> — {(h.metadata as { reason: string }).reason}</span>}
                    </span>
                    <span className="text-xs text-muted">{formatDate(h.createdAt, true)}</span>
                  </li>
                ))}
              </ol>
            )}
            {perms.includes("audit.read") && <p className="mt-3 text-sm"><Link href={`/admin/audit-logs?actorId=${u.id}`} className="font-semibold text-primary hover:underline">Full audit log</Link></p>}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          {!isSelf && perms.includes("users.manage") && <StatusActions id={u.id} status={u.status} isVerified={u.isVerified} />}
          {!isSelf && roles.length > 0 && <RolesEditor id={u.id} current={u.roles} roles={roles} isSuperAdmin={me.roles.includes("SUPER_ADMIN")} />}
          {isSelf && <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">This is your own account. Another administrator must change its status or roles.</p>}
        </aside>
      </div>
    </>
  );
}
