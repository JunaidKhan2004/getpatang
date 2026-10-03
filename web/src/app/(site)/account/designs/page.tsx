import type { Metadata } from "next";
import Link from "next/link";

import { KitePreview } from "@/components/designer/kite-preview";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { SHAPE_LABEL, type SavedDesign } from "@/lib/designer";
import { formatDate } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";

import { DeleteDesign } from "./delete-design";

export const metadata: Metadata = { title: "My designs" };

export default async function MyDesignsPage() {
  await requireUser("/account/designs");
  const designs = await api<SavedDesign[]>("/designs", { token: await getAccessToken() }).catch(() => null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/account" className="hover:text-primary">Account</Link> / Designs</nav>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My designs</h1>
        <div className="flex gap-2">
          <ButtonLink href="/account/custom-orders" variant="secondary">Custom orders</ButtonLink>
          <ButtonLink href="/designer">New design</ButtonLink>
        </div>
      </div>
      {!designs && <Alert tone="error">Your designs could not load. Please refresh the page.</Alert>}
      {designs && designs.length === 0 && <EmptyState title="No designs yet" message="Create a kite in the designer and save it here." action={<ButtonLink href="/designer">Open the designer</ButtonLink>} />}
      {designs && designs.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {designs.map((d) => (
            <li key={d.id} className="grid overflow-hidden rounded-md border border-border bg-surface">
              <Link href={`/designer?id=${d.id}`} className="kite-pattern grid place-items-center bg-surface-2 p-4" aria-label={`Edit ${d.name}`}>
                <KitePreview design={d.design} className="h-48 w-full" title={d.name} />
              </Link>
              <div className="grid gap-2 p-4">
                <div>
                  <h2 className="font-display font-semibold">{d.name}</h2>
                  <p className="text-xs text-muted">{SHAPE_LABEL[d.design.shape]} · saved {formatDate(d.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/account/custom-orders/new?design=${d.id}`} size="sm">Request quote</ButtonLink>
                  <ButtonLink href={`/designer?id=${d.id}`} size="sm" variant="secondary">Edit</ButtonLink>
                  <DeleteDesign id={d.id} name={d.name} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
