import { CalendarDays, MapPin, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/feedback";
import { KiteMark } from "@/components/ui/kite-mark";
import { formatDate, formatPKR } from "@/lib/market";
import { type TournamentCard as T, TOURNAMENT_STATUS_LABEL } from "@/lib/tournaments";
import { getT } from "@/lib/i18n/server";

export async function TournamentStatusBadge({ t }: { t: Pick<T, "status" | "registrationOpen"> }) {
  const tr = await getT();
  if (t.status === "IN_PROGRESS") return <Badge tone="danger">{tr("● Live")}</Badge>;
  if (t.registrationOpen) return <Badge tone="success">{tr("Registration open")}</Badge>;
  return <Badge tone={t.status === "COMPLETED" ? "neutral" : t.status === "CANCELLED" ? "danger" : "info"}>{tr(TOURNAMENT_STATUS_LABEL[t.status])}</Badge>;
}

export async function TournamentCard({ t }: { t: T }) {
  const tr = await getT();
  return (
    <Link href={`/tournaments/${t.slug}`} className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-primary">
      <div className="kite-pattern relative flex h-28 items-end bg-maroon-900 p-4">
        {t.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <KiteMark size={36} body="#ffffff" wing="#f2e4e4" className="absolute top-4 end-4 opacity-80" />
        <span className="relative"><TournamentStatusBadge t={t} /></span>
      </div>
      <div className="grid flex-1 content-start gap-2 p-4">
        <h3 className="font-display text-lg leading-snug font-semibold group-hover:text-primary">{t.name}</h3>
        <ul className="grid gap-1 text-sm text-muted">
          <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{formatDate(t.startsAt, true)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden="true" />{t.venue}, {t.city}</li>
          <li className="flex items-center gap-2"><Users className="size-4 shrink-0" aria-hidden="true" />{tr("{registered} / {max} players", { registered: t.registeredCount, max: t.maxParticipants })} · {t.entryFee ? formatPKR(t.entryFee) : tr("Free entry")}</li>
        </ul>
        <p className="mt-auto pt-1 text-xs text-muted">{tr("By {organizerName}", { organizerName: t.organizerName })}</p>
      </div>
    </Link>
  );
}
