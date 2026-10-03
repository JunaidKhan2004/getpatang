import { ModerationQueue } from "@/components/community/moderation-queue";

export const metadata = { title: "Reports" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; state?: string; page?: string }> }) {
  return (
    <ModerationQueue
      basePath="/admin/reports"
      title="Reports"
      description="Everything users have reported, grouped by item, most-reported first."
      types={["post", "comment", "user", "product", "shop", "match", "order"]}
      params={await searchParams}
    />
  );
}
