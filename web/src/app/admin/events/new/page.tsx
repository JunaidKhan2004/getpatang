import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";

import { EventForm } from "../event-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("New event") };
}

export default async function NewEventPage() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("New event")} description={t("Save as a draft, then publish when the details are final.")} />
      <EventForm initial={null} />
    </>
  );
}
