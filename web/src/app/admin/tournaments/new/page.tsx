import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";

import { TournamentForm } from "../tournament-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New tournament") };
}

export default async function NewTournamentPage() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("New tournament")} description={t("Save as a draft first; publish once the permit reference is in.")} />
      <TournamentForm initial={null} />
    </>
  );
}
