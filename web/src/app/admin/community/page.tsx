import type { Metadata } from "next";
import { ModerationQueue } from "@/components/community/moderation-queue";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Community") };
}

export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ type?: string; state?: string; page?: string }> }) {
  const t = await getT();
  return (
    <ModerationQueue
      basePath="/admin/community"
      title={t("Community moderation")}
      description={t("Reported posts, comments and profiles. Content with 5 or more reports is hidden automatically until you decide.")}
      types={["post", "comment", "user"]}
      params={await searchParams}
    />
  );
}
