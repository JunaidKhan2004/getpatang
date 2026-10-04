import type { Metadata } from "next";
import Link from "next/link";

import { EventCard } from "@/components/events/event-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { EventCard as E, RegistrationStatus } from "@/lib/events";
import { getAccessToken, requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My events") };
}

export default async function MyEventsPage() {
  const t = await getT();
  await requireUser("/account/events");
  const rows = await api<{ status: RegistrationStatus; guests: number; event: E }[]>("/events/mine", { token: await getAccessToken() }).catch(() => null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label={t("Breadcrumb")} className="mb-2 text-sm text-muted"><Link href="/account" className="hover:text-primary">{t("Account")}</Link> / Events</nav>
      <h1 className="mb-6 text-3xl font-bold">{t("My events")}</h1>
      {!rows && <Alert tone="error">{t("Your events could not load. Please refresh the page.")}</Alert>}
      {rows && rows.length === 0 && <EmptyState title={t("No registrations yet")} message={t("Find a festival or workshop near you.")} action={<ButtonLink href="/events">{t("Browse events")}</ButtonLink>} />}
      {rows && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.event.id} className="grid gap-2">
              <EventCard e={r.event} />
              <p className="flex items-center gap-2 text-sm">
                <Badge tone={r.status === "CONFIRMED" ? "success" : "warning"}>{r.status === "CONFIRMED" ? t("Confirmed") : t("Waiting list")}</Badge>
                {r.guests > 0 && <span className="text-muted">{t("+{guests} guest", { guests: r.guests })}{r.guests > 1 ? "s" : ""}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
