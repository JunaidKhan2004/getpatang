import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert, Badge } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { DOCUMENT_LABEL, PAYOUT_METHODS, type SellerApplication, SHOP_STATUS_LABEL, SHOP_STATUS_TONE } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ShopDecision } from "./shop-decision";

export const metadata = { title: "Seller review" };

type AdminShop = SellerApplication & {
  owner: { id: string; fullName: string; email: string; phone: string | null; createdAt: string };
  _count: { products: number; orders: number; followers: number };
  history: { action: string; metadata: { note?: string | null } | null; createdAt: string; actor: { fullName: string } | null }[];
};

export default async function AdminSellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let s: AdminShop;
  try {
    s = await api<AdminShop>(`/admin/shops/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2"><dt className="text-muted">{label}</dt><dd className="min-w-0 break-words">{value ?? "—"}</dd></div>
  );
  const box = "rounded-md border border-border bg-surface p-5";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/admin/sellers" className="hover:text-primary">Sellers</Link> / {s.name}</nav>
      <PageHeader
        title={s.name}
        description={`${s.city} · applied ${s.submittedAt ? formatDate(s.submittedAt, true) : "—"}`}
        actions={<div className="flex items-center gap-2"><Badge tone={SHOP_STATUS_TONE[s.status]}>{SHOP_STATUS_LABEL[s.status]}</Badge>{s.isVerified && <Badge tone="info">Verified</Badge>}</div>}
      />
      {s.reviewNote && <div className="mb-4"><Alert>Last note to seller: {s.reviewNote}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-6">
          <section aria-labelledby="shop" className={box}>
            <h2 id="shop" className="mb-2 font-display font-semibold">Shop</h2>
            <dl className="divide-y divide-border text-sm">
              {row("Web address", s.status === "APPROVED" ? <Link href={`/shops/${s.slug}`} className="text-primary hover:underline">/shops/{s.slug}</Link> : `/shops/${s.slug}`)}
              {row("Description", s.description)}
              {row("Address", s.address)}
              {row("Phone", s.phone)}
              {row("Email", s.email)}
              {row("Activity", `${s._count.products} products · ${s._count.orders} orders · ${s._count.followers} followers`)}
            </dl>
          </section>

          <section aria-labelledby="identity" className={box}>
            <h2 id="identity" className="mb-2 font-display font-semibold">Identity and payout</h2>
            <p className="mb-2 text-xs text-muted">Confidential. Do not share outside the review team.</p>
            <dl className="divide-y divide-border text-sm">
              {row("Owner", `${s.owner.fullName} (${s.owner.email}${s.owner.phone ? `, ${s.owner.phone}` : ""})`)}
              {row("Account since", formatDate(s.owner.createdAt))}
              {row("CNIC", s.cnicNumber?.replace(/^(\d{5})(\d{7})(\d)$/, "$1-$2-$3"))}
              {row("Payout", `${PAYOUT_METHODS.find((m) => m.value === s.payoutMethod)?.label ?? s.payoutMethod} · ${s.payoutAccountTitle} · ${s.payoutAccountNumber}`)}
            </dl>
            <h3 className="mt-4 mb-2 text-sm font-semibold">Documents</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {s.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-md border border-border p-3 text-sm hover:border-primary">
                    <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="grid min-w-0"><span className="font-medium">{DOCUMENT_LABEL[d.type] ?? d.type}</span><span className="truncate text-xs text-muted">{d.originalName}</span></span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <ShopDecision shopId={s.id} status={s.status} isVerified={s.isVerified} />
          <section aria-labelledby="history" className={box}>
            <h2 id="history" className="mb-3 font-display font-semibold">History</h2>
            <ol className="grid gap-3 text-sm">
              {s.history.map((h, i) => (
                <li key={i} className="grid gap-0.5 border-l-2 border-border pl-3">
                  <span className="font-medium">{h.action.replace(/^seller\./, "").replace(/_/g, " ")}</span>
                  {h.metadata?.note && <span className="text-muted">“{h.metadata.note}”</span>}
                  <span className="text-xs text-muted">{h.actor?.fullName ?? "System"} · {formatDate(h.createdAt, true)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
