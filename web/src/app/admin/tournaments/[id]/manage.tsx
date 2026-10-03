"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resolveDisputeAction, scheduleMatchAction, tournamentCommandAction, updateParticipantAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/market";
import { type AdminParticipant, MATCH_STATUS_LABEL, MATCH_STATUS_TONE, type MatchView, PARTICIPANT_STATUS_LABEL, type ParticipantStatus } from "@/lib/tournaments";

const notify = (res: { ok: boolean; message?: string }): void => {
  if (res.ok) toast.success(res.message);
  else toast.error(res.message);
};

export function TournamentCommands({ id, status, hasPermit, confirmed }: { id: string; status: string; hasPermit: boolean; confirmed: number }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<"bracket" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const run = (cmd: "publish" | "bracket" | "cancel") =>
    start(async () => {
      notify(await tournamentCommandAction(id, cmd, reason.trim() || undefined));
      setConfirm(null);
    });

  if (status === "COMPLETED" || status === "CANCELLED") return null;
  return (
    <section aria-label="Tournament actions" className="grid gap-3 rounded-md border border-primary/30 bg-primary-soft p-4">
      {!confirm && (
        <div className="flex flex-wrap items-center gap-2">
          {status === "DRAFT" && (
            <>
              <Button loading={pending} disabled={!hasPermit} onClick={() => run("publish")}>Publish</Button>
              {!hasPermit && <span className="text-sm text-muted">Add the permit reference in Details to publish.</span>}
            </>
          )}
          {status === "PUBLISHED" && (
            <Button disabled={confirmed < 2} onClick={() => setConfirm("bracket")}>Close registration and draw bracket</Button>
          )}
          {status === "PUBLISHED" && confirmed < 2 && <span className="text-sm text-muted">Needs at least 2 confirmed players.</span>}
          <Button variant="secondary" className="!text-danger" onClick={() => setConfirm("cancel")}>Cancel tournament</Button>
        </div>
      )}
      {confirm === "bracket" && (
        <div className="grid gap-2">
          <p className="text-sm">Draw the bracket with <strong>{confirmed}</strong> confirmed players? Registration closes and players still pending or waiting are not included. This cannot be undone.</p>
          <div className="flex gap-2"><Button loading={pending} onClick={() => run("bracket")}>Draw bracket</Button><Button variant="secondary" onClick={() => setConfirm(null)}>Back</Button></div>
        </div>
      )}
      {confirm === "cancel" && (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run("cancel"); }}>
          <label htmlFor="reason" className="text-sm font-medium">Reason (shown to players)</label>
          <input id="reason" required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
          <div className="flex gap-2"><Button type="submit" variant="danger" loading={pending}>Cancel tournament</Button><Button type="button" variant="secondary" onClick={() => setConfirm(null)}>Back</Button></div>
        </form>
      )}
    </section>
  );
}

const STATUS_CHOICES: ParticipantStatus[] = ["CONFIRMED", "WAITLISTED", "REJECTED", "DISQUALIFIED"];

export function ParticipantsManager({ tournamentId, participants, editable }: { tournamentId: string; participants: AdminParticipant[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const visible = participants.filter((p) => p.status !== "WITHDRAWN");
  if (!visible.length) return <EmptyState title="No registrations yet" message="Players appear here as they register." />;

  const update = (pid: string, body: { status?: string; seed?: number | null }) => start(async () => notify(await updateParticipantAction(tournamentId, pid, body)));

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
          <tr><th className="px-4 py-3 font-semibold">Player</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Registered</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Seed</th></tr>
        </thead>
        <tbody className="divide-y divide-border" aria-busy={pending}>
          {visible.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3"><div className="font-medium">{p.user.fullName}</div><div className="text-xs text-muted">{p.user.profile?.city ?? "—"}{p.user.profile?.dateOfBirth && ` · born ${formatDate(p.user.profile.dateOfBirth)}`}</div></td>
              <td className="px-4 py-3 text-muted"><div>{p.user.email}</div>{p.user.phone && <div>{p.user.phone}</div>}</td>
              <td className="px-4 py-3 text-muted">{formatDate(p.registeredAt, true)}</td>
              <td className="px-4 py-3">
                {editable ? (
                  <select
                    aria-label={`Status of ${p.user.fullName}`}
                    defaultValue={p.status}
                    disabled={pending}
                    onChange={(e) => update(p.id, { status: e.target.value })}
                    className="h-9 rounded-md border border-border bg-surface px-2"
                  >
                    {p.status === "PENDING" && <option value="PENDING" disabled>{PARTICIPANT_STATUS_LABEL.PENDING}</option>}
                    {STATUS_CHOICES.map((s) => <option key={s} value={s}>{PARTICIPANT_STATUS_LABEL[s]}</option>)}
                  </select>
                ) : (
                  <Badge>{PARTICIPANT_STATUS_LABEL[p.status]}</Badge>
                )}
                {p.statusNote && <div className="mt-1 text-xs text-muted">{p.statusNote}</div>}
              </td>
              <td className="px-4 py-3">
                {editable && p.status === "CONFIRMED" ? (
                  <input
                    aria-label={`Seed of ${p.user.fullName}`}
                    type="number"
                    min={1}
                    defaultValue={p.seed ?? ""}
                    placeholder="—"
                    onBlur={(e) => {
                      const seed = e.target.value ? Number(e.target.value) : null;
                      if (seed !== p.seed) update(p.id, { seed });
                    }}
                    className="h-9 w-16 rounded-md border border-border bg-surface px-2"
                  />
                ) : (
                  <span className="tabular-nums">{p.seed ?? "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && <p className="border-t border-border px-4 py-2 text-xs text-muted">Mark fee-paying players as Confirmed once you receive the fee. Seeds place players apart in the bracket; unseeded players are drawn at random.</p>}
    </div>
  );
}

const local = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function MatchRow({ tournamentId, m, officials }: { tournamentId: string; m: MatchView; officials: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [when, setWhen] = useState(local(m.scheduledAt));
  const [where, setWhere] = useState(m.location ?? "");
  const [official, setOfficial] = useState(m.official?.id ?? "");
  const [note, setNote] = useState("");
  const done = m.status === "COMPLETED" || m.status === "CANCELLED";
  const changed = when !== local(m.scheduledAt) || where !== (m.location ?? "") || official !== (m.official?.id ?? "");

  return (
    <li className="grid gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">#{m.matchNumber} · {m.roundName}</span>
        <Badge tone={MATCH_STATUS_TONE[m.status]}>{MATCH_STATUS_LABEL[m.status]}</Badge>
      </div>
      <p className="text-sm">
        <span className={m.winnerId === m.playerA?.participantId ? "font-semibold" : ""}>{m.playerA?.name ?? "TBD"}</span> vs{" "}
        <span className={m.winnerId === m.playerB?.participantId ? "font-semibold" : ""}>{m.playerB?.name ?? "TBD"}</span>
        {m.scoreA !== null && <span className="text-muted tabular-nums"> ({m.scoreA}–{m.scoreB})</span>}
        {m.isWalkover && <span className="text-muted"> · walkover</span>}
      </p>
      {m.status === "DISPUTED" && (
        <form
          className="grid gap-2 rounded-md border border-warning/40 bg-warning/10 p-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <p className="text-sm"><strong>Dispute:</strong> {m.disputeReason}</p>
          <label htmlFor={`n-${m.id}`} className="text-xs font-medium">Decision note (shown in the match history)</label>
          <input id={`n-${m.id}`} value={note} onChange={(e) => setNote(e.target.value)} minLength={5} className="h-9 rounded-md border border-border bg-surface px-2 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={note.trim().length < 5 || pending} onClick={() => start(async () => notify(await resolveDisputeAction(tournamentId, m.id, "uphold", note.trim())))}>Keep result</Button>
            {m.winnerId && (
              <Button size="sm" variant="danger" disabled={note.trim().length < 5 || pending} onClick={() => start(async () => notify(await resolveDisputeAction(tournamentId, m.id, "overturn", note.trim())))}>Overturn (other player wins)</Button>
            )}
          </div>
        </form>
      )}
      {!done && m.status !== "DISPUTED" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-medium">Time<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium">Field / area<input value={where} maxLength={60} onChange={(e) => setWhere(e.target.value)} placeholder="Field 1" className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-medium">Official
            <select value={official} onChange={(e) => setOfficial(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
              <option value="">Not assigned</option>
              {officials.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <Button
            size="sm"
            disabled={!changed}
            loading={pending}
            onClick={() =>
              start(async () =>
                notify(await scheduleMatchAction(tournamentId, m.id, { scheduledAt: when ? new Date(when).toISOString() : null, location: where || null, officialId: official || null })),
              )
            }
          >
            Save
          </Button>
        </div>
      )}
      {m.scheduledAt && done && <p className="text-xs text-muted">{formatDate(m.scheduledAt, true)}{m.location && ` · ${m.location}`}</p>}
    </li>
  );
}

export function MatchesManager({ tournamentId, matches, officials }: { tournamentId: string; matches: MatchView[]; officials: { id: string; name: string }[] }) {
  if (!matches.length) return <EmptyState title="No matches" message="Matches are created when the bracket is drawn." />;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">Assign an official to each match. Officials run their matches and record results from <Link href="/admin/matches" className="font-semibold text-primary hover:underline">Matches</Link>.</p>
      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
        {matches.map((m) => <MatchRow key={m.id} tournamentId={tournamentId} m={m} officials={officials} />)}
      </ul>
    </div>
  );
}
