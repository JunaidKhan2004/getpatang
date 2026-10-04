"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { matchResultAction, matchStatusAction } from "@/app/actions/tournaments";
import { type Uploaded, SingleUpload } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";

import { MATCH_STATUS_LABEL, MATCH_STATUS_TONE, type MatchView } from "@/lib/tournaments";
import { useT, useFormat } from "@/lib/i18n/client";

export function OfficialMatch({ m }: { m: MatchView }) {
  const { formatDate } = useFormat();
  const t = useT();
  const [pending, start] = useTransition();
  const [resultOpen, setResultOpen] = useState(false);
  const [winner, setWinner] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [walkover, setWalkover] = useState(false);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<Uploaded | null>(null);
  const ready = Boolean(m.playerA && m.playerB);

  const notify = (res: { ok: boolean; message?: string }): void => {
  if (res.ok) toast.success(res.message);
  else toast.error(res.message);
};

  return (
    <li className={`grid gap-3 rounded-md border bg-surface p-5 ${m.status === "LIVE" ? "border-danger" : "border-border"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display font-semibold">{m.tournament.name}</p>
          <p className="text-sm text-muted">{t("Match {matchNumber}", { matchNumber: m.matchNumber })}{m.scheduledAt && ` · ${formatDate(m.scheduledAt, true)}`}{m.location && ` · ${m.location}`}</p>
        </div>
        <Badge tone={MATCH_STATUS_TONE[m.status]}>{t(MATCH_STATUS_LABEL[m.status])}</Badge>
      </div>
      <p className="text-lg"><strong>{m.playerA?.name ?? "TBD"}</strong> <span className="text-muted">{t("vs")}</span> <strong>{m.playerB?.name ?? "TBD"}</strong></p>
      {m.status === "DISPUTED" && <p className="text-sm text-warning">{t("Disputed: {disputeReason}. A tournament manager will decide.", { disputeReason: m.disputeReason })}</p>}

      {!ready && <p className="text-sm text-muted">{t("Waiting for the previous round to finish.")}</p>}
      {ready && !resultOpen && (
        <div className="flex flex-wrap gap-2">
          {m.status === "SCHEDULED" && <Button variant="secondary" loading={pending} onClick={() => start(async () => notify(await matchStatusAction(m.id, "CHECK_IN")))}>{t("Start check-in")}</Button>}
          {(m.status === "SCHEDULED" || m.status === "CHECK_IN") && <Button loading={pending} onClick={() => start(async () => notify(await matchStatusAction(m.id, "LIVE")))}>{t("Start match")}</Button>}
          {(m.status === "LIVE" || m.status === "CHECK_IN") && <Button onClick={() => setResultOpen(true)}>{t("Record result")}</Button>}
          {m.status === "SCHEDULED" && <Button variant="secondary" onClick={() => { setWalkover(true); setResultOpen(true); }}>{t("Record walkover")}</Button>}
        </div>
      )}

      {resultOpen && m.playerA && m.playerB && (
        <form
          className="grid gap-3 rounded-md border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await matchResultAction(m.id, {
                winnerId: winner,
                walkover,
                ...(!walkover && scoreA !== "" && scoreB !== "" && { scoreA: Number(scoreA), scoreB: Number(scoreB) }),
                note: note.trim() || undefined,
                evidenceUploadId: evidence?.id,
              });
              notify(res);
              if (res.ok) setResultOpen(false);
            });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">{t("Winner")}</legend>
            {[m.playerA, m.playerB].map((p) => (
              <label key={p.participantId} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name={`w-${m.id}`} required value={p.participantId} checked={winner === p.participantId} onChange={() => setWinner(p.participantId)} className="accent-[var(--primary)]" />
                {p.name}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={walkover} onChange={(e) => setWalkover(e.target.checked)} className="size-4 accent-[var(--primary)]" /> {" "}{t("Walkover (the other player did not play)")}</label>
          {!walkover && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">{t("{name} score", { name: m.playerA.name })}<input type="number" min={0} value={scoreA} onChange={(e) => setScoreA(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3" /></label>
              <label className="grid gap-1 text-sm">{t("{name} score", { name: m.playerB.name })}<input type="number" min={0} value={scoreB} onChange={(e) => setScoreB(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3" /></label>
            </div>
          )}
          <label className="grid gap-1 text-sm">{t("Note (optional)")}<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3" /></label>
          <SingleUpload label={t("Evidence (optional)")} purpose="match_evidence" value={evidence} onChange={setEvidence} hint={t("Photo or PDF of the score sheet. Only staff can see it.")} />
          <p className="text-xs text-muted">{t("The result is official and moves the winner to the next round. Players can dispute it until their next match starts.")}</p>
          <div className="flex gap-2">
            <Button type="submit" loading={pending} disabled={!winner}>{t("Submit official result")}</Button>
            <Button type="button" variant="secondary" onClick={() => { setResultOpen(false); setWalkover(false); }}>{t("Back")}</Button>
          </div>
        </form>
      )}
    </li>
  );
}
