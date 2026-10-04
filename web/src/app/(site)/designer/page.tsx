import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { SavedDesign } from "@/lib/designer";
import { getAccessToken, getCurrentUser } from "@/lib/session";

import { Designer } from "./designer";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Kite designer"), description: t("Design your own kite and ask a shop for a quote.") };
}

export default async function DesignerPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const t = await getT();
  const { id } = await searchParams;
  const user = await getCurrentUser();
  const initial = id && user ? await api<SavedDesign>(`/designs/${encodeURIComponent(id)}`, { token: await getAccessToken() }).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-3xl font-bold">{initial ? t("Edit “{name}”", { name: initial.name }) : t("Kite designer")}</h1>
          <p className="text-muted">{t("Pick a shape, colours and your team name, then ask a shop for a quote.")}</p>
        </div>
        {user && <Link href="/account/designs" className="text-sm font-semibold text-primary hover:underline">{t("My designs")}</Link>}
      </div>
      {id && !initial && <div className="mb-6"><Alert tone="error">{t("That design could not be found. You can start a new one below.")}</Alert></div>}
      {!user && <div className="mb-6"><Alert>{t("You can try the designer freely. Sign in to save a design or request a quote.")}</Alert></div>}
      <Designer key={initial?.id ?? "new"} initial={initial} />
    </div>
  );
}
