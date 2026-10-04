import Link from "next/link";

import { formatDate } from "@/lib/market";
import { MATCH_STATUS_LABEL, type MatchPlayer, type MatchView } from "@/lib/tournaments";
import { getT } from "@/lib/i18n/server";

async function PlayerLine({ p, score, won, decided }: { p: MatchPlayer | null; score: number | null; won: boolean; decided: boolean }) {
  const t = await getT();
  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${won ? "font-semibold" : decided ? "text-muted" : ""}`}>
      {p ? (
        <Link href={`/players/${p.userId}`} className="min-w-0 truncate hover:text-primary">
          {p.seed && <span className="me-1 text-xs text-muted tabular-nums">{p.seed}</span>}
          {p.name}
        </Link>
      ) : (
        <span className="text-muted italic">{t("To be decided")}</span>
      )}
      <span className="shrink-0 tabular-nums">{score ?? (won ? "✓" : "")}</span>
    </div>
  );
}

export async function MatchCard({ m }: { m: MatchView }) {
  const t = await getT();
  const decided = Boolean(m.winnerId);
  const live = m.status === "LIVE";
  return (
    <div className={`w-56 overflow-hidden rounded-md border bg-surface ${live ? "border-danger" : "border-border"}`}>
      <div className="flex items-center justify-between bg-surface-2 px-3 py-1 text-[11px] text-muted">
        <span>{t("Match {matchNumber}", { matchNumber: m.matchNumber })}</span>
        <span className={live ? "font-semibold text-danger" : ""}>{m.isBye ? t("Bye") : live ? t("● Live") : t(MATCH_STATUS_LABEL[m.status])}</span>
      </div>
      <PlayerLine p={m.playerA} score={m.scoreA} won={decided && m.winnerId === m.playerA?.participantId} decided={decided} />
      <div className="border-t border-border" />
      <PlayerLine p={m.playerB} score={m.scoreB} won={decided && m.winnerId === m.playerB?.participantId} decided={decided} />
      {(m.scheduledAt || m.location) && !decided && (
        <div className="border-t border-border px-3 py-1 text-[11px] text-muted">
          {[m.scheduledAt && formatDate(m.scheduledAt, true), m.location].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

/** Rounds as columns; each column spreads its matches evenly so pairs line up with the next round. */
export async function BracketView({ rounds }: { rounds: { round: number; name: string; matches: MatchView[] }[] }) {
  const t = await getT();
  if (!rounds.length) return <p className="text-muted">{t("The bracket appears here once the organizer draws it.")}</p>;
  return (
    <div className="overflow-x-auto pb-2" role="region" aria-label={t("Tournament bracket")} tabIndex={0}>
      <div className="flex min-w-max gap-6">
        {rounds.map((r) => (
          <section key={r.round} aria-label={r.name} className="flex flex-col">
            <h3 className="mb-3 text-center font-display text-sm font-semibold">{r.name}</h3>
            <div className="flex flex-1 flex-col justify-around gap-4">
              {r.matches.map((m) => <MatchCard key={m.id} m={m} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
