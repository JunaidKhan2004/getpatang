import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { SavedDesign } from "@/lib/designer";
import { getAccessToken, getCurrentUser } from "@/lib/session";

import { Designer } from "./designer";

export const metadata: Metadata = { title: "Kite designer", description: "Design your own kite and ask a shop for a quote." };

export default async function DesignerPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const user = await getCurrentUser();
  const initial = id && user ? await api<SavedDesign>(`/designs/${encodeURIComponent(id)}`, { token: await getAccessToken() }).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold">{initial ? `Edit “${initial.name}”` : "Kite designer"}</h1>
          <p className="text-muted">Pick a shape, colours and your team name, then ask a shop for a quote.</p>
        </div>
        {user && <Link href="/account/designs" className="text-sm font-semibold text-primary hover:underline">My designs</Link>}
      </div>
      {id && !initial && <div className="mb-6"><Alert tone="error">That design could not be found. You can start a new one below.</Alert></div>}
      {!user && <div className="mb-6"><Alert>You can try the designer freely. Sign in to save a design or request a quote.</Alert></div>}
      <Designer key={initial?.id ?? "new"} initial={initial} />
    </div>
  );
}
