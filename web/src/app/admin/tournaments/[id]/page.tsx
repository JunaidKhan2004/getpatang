import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { BracketView } from "@/components/tournaments/bracket-view";
import { Alert, Badge } from "@/components/ui/feedback";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";
import { type AdminParticipant, type MatchView, TOURNAMENT_STATUS_LABEL } from "@/lib/tournaments";

import { TournamentForm, type TournamentFormValues } from "../tournament-form";
import { MatchesManager, ParticipantsManager, TournamentCommands } from "./manage";

export const metadata = { title: "Manage tournament" };

type AdminTournament = TournamentFormValues & {
  id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  cancelReason: string | null;
  participants: AdminParticipant[];
  matches: MatchView[];
};

export default async function ManageTournamentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const tab = (await searchParams).tab ?? "players";
  const token = await getAccessToken();
  let t: AdminTournament;
  try {
    t = await api<AdminTournament>(`/admin/tournaments/${encodeURIComponent(id)}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const officials = t.status === "IN_PROGRESS" ? await api<{ id: string; name: string; email: string }[]>("/admin/officials", { token }).catch(() => []) : [];
  const rounds = Array.from(new Set(t.matches.map((m) => m.round))).sort((a, b) => a - b).map((r) => ({
    round: r,
    name: t.matches.find((m) => m.round === r)?.roundName ?? `Round ${r}`,
    matches: t.matches.filter((m) => m.round === r),
  }));
  const editable = t.status === "DRAFT" || t.status === "PUBLISHED";
  const tabs = [
    { key: "players", label: `Players (${t.participants.filter((p) => p.status !== "WITHDRAWN").length})` },
    ...(t.matches.length ? [{ key: "matches", label: "Matches" }, { key: "bracket", label: "Bracket" }] : []),
    ...(editable ? [{ key: "details", label: "Details" }] : []),
  ];
  const disputes = t.matches.filter((m) => m.status === "DISPUTED").length;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/admin/tournaments" className="hover:text-primary">Tournaments</Link> / {t.name}</nav>
      <PageHeader
        title={t.name}
        description={`${t.venue}, ${t.city} · ${formatDate(t.startsAt, true)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={t.status === "IN_PROGRESS" ? "danger" : t.status === "PUBLISHED" ? "info" : "neutral"}>{TOURNAMENT_STATUS_LABEL[t.status]}</Badge>
            {t.status !== "DRAFT" && <Link href={`/tournaments/${t.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">Public page</Link>}
          </div>
        }
      />
      {t.status === "CANCELLED" && <div className="mb-4"><Alert tone="error">Cancelled: {t.cancelReason}</Alert></div>}
      {disputes > 0 && <div className="mb-4"><Alert tone="error">{disputes} disputed {disputes === 1 ? "match needs" : "matches need"} a decision. See the Matches tab.</Alert></div>}

      <TournamentCommands id={t.id} status={t.status} hasPermit={Boolean(t.permitReference)} confirmed={t.participants.filter((p) => p.status === "CONFIRMED").length} />

      <nav aria-label="Sections" className="my-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((x) => (
          <Link key={x.key} href={`/admin/tournaments/${id}?tab=${x.key}`} aria-current={tab === x.key ? "page" : undefined} className="-mb-px shrink-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted hover:text-ink aria-[current=page]:border-primary aria-[current=page]:text-primary">
            {x.label}
          </Link>
        ))}
      </nav>

      {tab === "players" && <ParticipantsManager tournamentId={t.id} participants={t.participants} editable={editable} />}
      {tab === "matches" && <MatchesManager tournamentId={t.id} matches={t.matches.filter((m) => !m.isBye)} officials={officials} />}
      {tab === "bracket" && <BracketView rounds={rounds} />}
      {tab === "details" && editable && <TournamentForm initial={t} />}
    </>
  );
}
