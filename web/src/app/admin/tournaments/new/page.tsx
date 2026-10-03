import { PageHeader } from "@/components/dashboard/dashboard-shell";

import { TournamentForm } from "../tournament-form";

export const metadata = { title: "New tournament" };

export default function NewTournamentPage() {
  return (
    <>
      <PageHeader title="New tournament" description="Save as a draft first; publish once the permit reference is in." />
      <TournamentForm initial={null} />
    </>
  );
}
