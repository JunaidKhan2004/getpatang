import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";

import { RecalculateButton } from "./recalculate";

export const metadata = { title: "Rankings" };

export default function AdminRankingsPage() {
  return (
    <>
      <PageHeader title="Rankings" description="Rankings are calculated from official results in completed tournaments." actions={<Link href="/rankings" target="_blank" className="text-sm font-semibold text-primary hover:underline">Public rankings</Link>} />
      <section className="grid max-w-2xl gap-3 rounded-md border border-border bg-surface p-5 text-sm">
        <h2 className="font-display text-base font-semibold">Points formula</h2>
        <p className="text-muted">
          The formula is the platform setting <code className="rounded bg-surface-2 px-1">rankings.points</code> (points per placement, for taking part, and per match won).
          After changing it, recalculate so past tournaments use the new formula too. Results themselves never change.
        </p>
        <div><RecalculateButton /></div>
      </section>
    </>
  );
}
