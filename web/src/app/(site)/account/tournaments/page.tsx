import type { Metadata } from "next";
import Link from "next/link";

import { TournamentStatusBadge } from "@/components/tournaments/tournament-card";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken, requireUser } from "@/lib/session";
import { PARTICIPANT_STATUS_LABEL, type ParticipantStatus, placementLabel, type TournamentCard } from "@/lib/tournaments";

export const metadata: Metadata = { title: "My tournaments" };

interface Entry {
  entryId: string;
  status: ParticipantStatus;
  statusNote: string | null;
  finalPlacement: number | null;
  tournament: TournamentCard;
}

export default async function MyTournamentsPage() {
  const user = await requireUser("/account/tournaments");
  const entries = await api<Entry[]>("/tournaments/mine", { token: await getAccessToken() }).catch(() => null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/account" className="hover:text-primary">My account</Link> / Tournaments</nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">My tournaments</h1>
        <Link href={`/players/${user.id}`} className="text-sm font-semibold text-primary hover:underline">View my player profile</Link>
      </div>
      {!entries && <Alert tone="error">Your tournaments could not load. Please refresh the page.</Alert>}
      {entries && entries.length === 0 && (
        <EmptyState title="No tournaments yet" message="Register for an approved tournament near you." action={<ButtonLink href="/tournaments?view=open">Find tournaments</ButtonLink>} />
      )}
      {entries && entries.length > 0 && (
        <ul className="grid gap-3">
          {entries.map((e) => (
            <li key={e.entryId}>
              <Link href={`/tournaments/${e.tournament.slug}`} className="grid gap-2 rounded-md border border-border bg-surface p-4 hover:border-primary sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{e.tournament.name}</span>
                  <span className="text-sm text-muted">{e.tournament.venue}, {e.tournament.city} · {formatDate(e.tournament.startsAt, true)}</span>
                  {e.statusNote && <span className="text-sm text-muted">{e.statusNote}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <TournamentStatusBadge t={e.tournament} />
                  <Badge tone={e.status === "CONFIRMED" ? "success" : e.status === "PENDING" || e.status === "WAITLISTED" ? "warning" : "danger"}>{PARTICIPANT_STATUS_LABEL[e.status]}</Badge>
                  {e.finalPlacement && <Badge tone="brand">{placementLabel(e.finalPlacement)}</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
