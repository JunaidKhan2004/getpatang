import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { CustomShop, SavedDesign } from "@/lib/designer";
import { getAccessToken, requireUser } from "@/lib/session";

import { RequestForm } from "./request-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Request a quote") };
}

export default async function NewCustomOrderPage({ searchParams }: { searchParams: Promise<{ design?: string; shop?: string }> }) {
  const t = await getT();
  const { design: designId, shop } = await searchParams;
  await requireUser(`/account/custom-orders/new${designId ? `?design=${designId}` : ""}`);
  const token = await getAccessToken();
  const [designs, shops] = await Promise.all([
    api<SavedDesign[]>("/designs", { token }).catch(() => null),
    api<CustomShop[]>("/custom-orders/shops").catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/account/custom-orders" className="hover:text-primary">{t("Custom orders")}</Link> / New request</nav>
      <h1 className="mb-6 text-3xl font-bold">{t("Request a quote")}</h1>
      {(!designs || !shops) && <Alert tone="error">{t("This page could not load. Please refresh.")}</Alert>}
      {designs && designs.length === 0 && <EmptyState title={t("Save a design first")} message={t("Create your kite in the designer, then come back here.")} action={<ButtonLink href="/designer">{t("Open the designer")}</ButtonLink>} />}
      {designs && shops && shops.length === 0 && designs.length > 0 && <EmptyState title={t("No shops are taking custom orders right now")} message={t("Please check again soon.")} />}
      {designs && shops && designs.length > 0 && shops.length > 0 && (
        <RequestForm designs={designs} shops={shops} initialDesign={designs.some((d) => d.id === designId) ? designId! : designs[0].id} initialShop={shops.some((s) => s.id === shop) ? shop : undefined} />
      )}
    </div>
  );
}
