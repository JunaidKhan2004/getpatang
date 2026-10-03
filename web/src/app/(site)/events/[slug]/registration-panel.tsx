"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelEventRegistrationAction, registerEventAction } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import type { EventDetail } from "@/lib/events";
import { formatDate } from "@/lib/market";

export function EventRegistrationPanel({ e }: { e: EventDetail }) {
  const router = useRouter();
  const pathname = usePathname();
  const [guests, setGuests] = useState(0);
  const [pending, start] = useTransition();
  const box = "grid gap-3 rounded-md border border-border bg-surface p-5";

  const done = (res: { ok: boolean; message?: string; signIn?: boolean }) => {
    if (res.signIn) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    if (res.ok) {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };

  if (!e.registrationRequired) {
    return (
      <section className={box}>
        <h2 className="font-display font-semibold">Open to everyone</h2>
        <p className="text-sm text-muted">No registration needed. Just come along.</p>
      </section>
    );
  }

  if (e.myRegistration) {
    const r = e.myRegistration;
    return (
      <section className={box} aria-labelledby="my-reg">
        <h2 id="my-reg" className="font-display font-semibold">You are registered</h2>
        <Badge tone={r.status === "CONFIRMED" ? "success" : "warning"}>{r.status === "CONFIRMED" ? "Confirmed" : "On the waiting list"}</Badge>
        <p className="text-sm text-muted">{r.guests ? `You plus ${r.guests} guest${r.guests > 1 ? "s" : ""}.` : "Just you."}</p>
        {e.status === "PUBLISHED" && new Date(e.startsAt) > new Date() && (
          <Button variant="secondary" loading={pending} onClick={() => start(async () => done(await cancelEventRegistrationAction(e.slug)))}>Cancel registration</Button>
        )}
      </section>
    );
  }

  if (!e.registrationOpen) {
    return (
      <section className={box}>
        <h2 className="font-display font-semibold">Registration</h2>
        <p className="text-sm text-muted">Registration is closed.</p>
      </section>
    );
  }

  const left = e.capacity === null ? null : Math.max(0, e.capacity - e.attending);
  return (
    <section className={box} aria-labelledby="reg">
      <h2 id="reg" className="font-display font-semibold">Register</h2>
      <p className="text-sm text-muted">
        {left === null ? "No limit on places." : left === 0 ? "The event is full. You can join the waiting list." : `${left} places left.`}
        {e.registrationClosesAt && ` Closes ${formatDate(e.registrationClosesAt, true)}.`}
      </p>
      {e.maxGuests > 0 && (
        <label className="grid gap-1 text-sm font-medium">
          Guests coming with you
          <select value={guests} onChange={(ev) => setGuests(Number(ev.target.value))} className="h-11 rounded-md border border-border bg-surface px-3">
            {Array.from({ length: e.maxGuests + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? "None" : i}</option>)}
          </select>
        </label>
      )}
      <Button loading={pending} onClick={() => start(async () => done(await registerEventAction(e.slug, guests)))}>
        {left === 0 ? "Join the waiting list" : "Register"}
      </Button>
    </section>
  );
}
