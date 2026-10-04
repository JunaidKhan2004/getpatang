import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/feedback";
import { KiteMark } from "@/components/ui/kite-mark";
import { EVENT_STATUS_LABEL, EVENT_TYPE_LABEL, type EventCard as E } from "@/lib/events";
import { formatDate, formatPKR } from "@/lib/market";
import { getT } from "@/lib/i18n/server";

export async function EventStatusBadge({ e }: { e: Pick<E, "status" | "registrationOpen" | "registrationRequired"> }) {
  const t = await getT();
  if (e.status === "CANCELLED") return <Badge tone="danger">{t("Cancelled")}</Badge>;
  if (e.status === "COMPLETED") return <Badge>{t(EVENT_STATUS_LABEL.COMPLETED)}</Badge>;
  if (e.registrationOpen) return <Badge tone="success">{t("Registration open")}</Badge>;
  return <Badge tone="info">{e.registrationRequired ? t("Registration closed") : t("Open to all")}</Badge>;
}

export async function EventCard({ e }: { e: E }) {
  const t = await getT();
  return (
    <Link href={`/events/${e.slug}`} className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-primary">
      <div className="kite-pattern relative flex h-28 items-end gap-2 bg-maroon-900 p-4">
        {e.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <KiteMark size={36} body="#ffffff" wing="#f2e4e4" className="absolute top-4 end-4 opacity-80" />
        <span className="relative flex gap-2"><Badge tone="brand">{t(EVENT_TYPE_LABEL[e.type])}</Badge><EventStatusBadge e={e} /></span>
      </div>
      <div className="grid flex-1 content-start gap-2 p-4">
        <h3 className="font-display text-lg leading-snug font-semibold group-hover:text-primary">{e.name}</h3>
        <ul className="grid gap-1 text-sm text-muted">
          <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{formatDate(e.startsAt, true)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden="true" />{e.venue}, {e.city}</li>
          <li className="flex items-center gap-2">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            {e.capacity ? `${e.attending} / ${e.capacity} going` : `${e.attending} going`} · {e.fee ? formatPKR(e.fee) : t("Free")}
          </li>
        </ul>
        <p className="mt-auto pt-1 text-xs text-muted">{t("By {organizerName}", { organizerName: e.organizerName })}</p>
      </div>
    </Link>
  );
}
