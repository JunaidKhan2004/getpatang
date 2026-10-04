import type { Metadata } from "next";
import { ModerationQueue } from "@/components/community/moderation-queue";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reports") };
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; state?: string; page?: string }> }) {
  const t = await getT();
  return (
    <ModerationQueue
      basePath="/admin/reports"
      title={t("Reports")}
      description={t("Everything users have reported, grouped by item, most-reported first.")}
      types={["post", "comment", "user", "product", "shop", "match", "order"]}
      params={await searchParams}
    />
  );
}
