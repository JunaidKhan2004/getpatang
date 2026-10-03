import { PageHeader } from "@/components/dashboard/dashboard-shell";

import { EventForm } from "../event-form";

export const metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <>
      <PageHeader title="New event" description="Save as a draft, then publish when the details are final." />
      <EventForm initial={null} />
    </>
  );
}
