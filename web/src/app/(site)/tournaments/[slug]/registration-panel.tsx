"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerAction, withdrawAction } from "@/app/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { formatDate } from "@/lib/market";
import { PARTICIPANT_STATUS_LABEL, placementLabel, type TournamentDetail } from "@/lib/tournaments";

export function RegistrationPanel({ t }: { t: TournamentDetail }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [dob, setDob] = useState("");
  const [needDob, setNeedDob] = useState(false);
  const [pending, start] = useTransition();
  const entry = t.myEntry && t.myEntry.status !== "WITHDRAWN" ? t.myEntry : null;

  const register = () =>
    start(async () => {
      const res = await registerAction(t.slug, { acceptRules: accepted, ...(dob && { dateOfBirth: new Date(dob).toISOString() }) });
      if (res.signIn) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        if (res.fieldErrors?.dateOfBirth) setNeedDob(true);
        toast.error(res.message);
      }
    });

  const withdraw = () =>
    start(async () => {
      const res = await withdrawAction(t.slug);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  const box = "grid gap-3 rounded-md border border-border bg-surface p-5";

  if (entry) {
    return (
      <section className={box} aria-labelledby="my-entry">
        <h2 id="my-entry" className="font-display font-semibold">Your registration</h2>
        <Badge tone={entry.status === "CONFIRMED" ? "success" : entry.status === "PENDING" || entry.status === "WAITLISTED" ? "warning" : "danger"}>
          {PARTICIPANT_STATUS_LABEL[entry.status]}
        </Badge>
        {entry.finalPlacement && <p className="font-semibold">Final result: {placementLabel(entry.finalPlacement)}</p>}
        {entry.statusNote && <p className="text-sm text-muted">{entry.statusNote}</p>}
        {entry.status === "PENDING" && t.entryFee > 0 && <p className="text-sm">Pay the entry fee to the organizer to confirm your spot.</p>}
        {t.status === "PUBLISHED" && ["PENDING", "CONFIRMED", "WAITLISTED"].includes(entry.status) && (
          <Button variant="secondary" loading={pending} onClick={withdraw}>Withdraw</Button>
        )}
      </section>
    );
  }

  if (!t.registrationOpen) {
    const before = t.status === "PUBLISHED" && new Date(t.registrationOpensAt) > new Date();
    return (
      <section className={box}>
        <h2 className="font-display font-semibold">Registration</h2>
        <p className="text-sm text-muted">{before ? `Opens ${formatDate(t.registrationOpensAt, true)}.` : "Registration is closed."}</p>
      </section>
    );
  }

  const full = t.registeredCount >= t.maxParticipants;
  return (
    <section className={box} aria-labelledby="register">
      <h2 id="register" className="font-display font-semibold">Register</h2>
      <p className="text-sm text-muted">
        {full ? "The tournament is full. You can join the waiting list." : `${t.maxParticipants - t.registeredCount} spots left.`} Closes {formatDate(t.registrationClosesAt, true)}.
      </p>
      {!open ? (
        <Button onClick={() => setOpen(true)}>{full ? "Join the waiting list" : "Register now"}</Button>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
        >
          <Alert>Players must be at least {t.minAge}. Approved materials: {t.approvedMaterials}</Alert>
          {needDob && (
            <label className="grid gap-1 text-sm font-medium">
              Date of birth
              <input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="h-11 rounded-md border border-border bg-surface px-3" />
              <span className="text-xs font-normal text-muted">Used only to check the age limit.</span>
            </label>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
            I have read the rules and safety requirements, and I will use only the approved materials.
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={pending} disabled={!accepted}>Confirm registration</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
