import { ModerationQueue } from "@/components/community/moderation-queue";

export const metadata = { title: "Community" };

export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ type?: string; state?: string; page?: string }> }) {
  return (
    <ModerationQueue
      basePath="/admin/community"
      title="Community moderation"
      description="Reported posts, comments and profiles. Content with 5 or more reports is hidden automatically until you decide."
      types={["post", "comment", "user"]}
      params={await searchParams}
    />
  );
}
