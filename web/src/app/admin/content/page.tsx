import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/feedback";
import type { ContentPageRow } from "@/lib/admin";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

import { ContentEditor } from "./content-editor";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Content") };
}

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const pages = await api<ContentPageRow[]>("/admin/pages", { token: await getAccessToken() }).catch(() => null);
  const selected = (await searchParams).page;

  return (
    <>
      <PageHeader title={t("Content")} description={t("Public pages such as About, FAQ, Terms and Privacy. Have legal text checked by your lawyer before publishing.")} />
      {!pages && <Alert tone="error">{t("Pages could not load. You may not have permission to manage content.")}</Alert>}
      {pages && <ContentEditor pages={pages} initial={pages.some((p) => p.slug === selected) ? selected! : pages[0].slug} />}
    </>
  );
}
