"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveEventAction } from "@/app/actions/events";
import { SingleUpload, type Uploaded } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import { type AdminEvent, EVENT_TYPE_LABEL, EVENT_TYPES } from "@/lib/events";
import { PAKISTAN_CITIES } from "@/lib/validation";

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
const local = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const textarea = "w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function EventForm({ initial }: { initial: AdminEvent | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [banner, setBanner] = useState<Uploaded | null>(initial?.bannerUrl ? { id: "", url: initial.bannerUrl, originalName: "Current banner" } : null);
  const [needsReg, setNeedsReg] = useState(initial?.registrationRequired ?? true);
  const v = initial;

  const submit = (fd: FormData) => {
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    const iso = (k: string) => (str(k) ? new Date(str(k)).toISOString() : undefined);
    const body = {
      name: str("name"),
      type: str("type"),
      description: str("description"),
      city: str("city"),
      venue: str("venue"),
      venueAddress: str("venueAddress") || undefined,
      startsAt: iso("startsAt"),
      endsAt: iso("endsAt"),
      organizerName: str("organizerName"),
      organizerContact: str("organizerContact") || undefined,
      rules: str("rules") || undefined,
      safetyNotes: str("safetyNotes"),
      registrationRequired: needsReg,
      registrationClosesAt: needsReg ? iso("registrationClosesAt") : undefined,
      capacity: needsReg && str("capacity") ? Number(str("capacity")) : null,
      maxGuests: needsReg ? Number(str("maxGuests") || 0) : 0,
      fee: Number(str("fee") || 0),
      tournamentSlug: str("tournamentSlug") || undefined,
      bannerUploadId: banner?.id ? banner.id : !banner && v?.bannerUrl ? null : undefined,
    };
    start(async () => {
      const res = await saveEventAction(v?.id ?? null, body);
      setErrors(res.fieldErrors ?? {});
      if (!res.ok) {
        setFormError(res.message);
        toast.error(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setFormError(undefined);
      toast.success(res.message);
      if (!v?.id && res.id) router.push(`/admin/events/${res.id}`);
      else router.refresh();
    });
  };

  const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
  const area = (name: string, label: string, value: string | null | undefined, rows: number, required: boolean, hint?: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={`ev-${name}`} className="text-sm font-medium">{label}</label>
      <textarea id={`ev-${name}`} name={name} required={required} rows={rows} defaultValue={value ?? ""} className={textarea} />
      {errors[name] ? <p className="text-sm text-danger">{errors[name]}</p> : hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );

  return (
    <form action={submit} className="grid gap-6">
      {formError && <Alert tone="error">{formError}</Alert>}

      <section className={card} aria-labelledby="ev-basics">
        <h2 id="ev-basics" className="font-display font-semibold">Event</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <Field label="Name" name="name" required minLength={5} maxLength={100} defaultValue={v?.name} error={errors.name} />
          <div className="grid gap-1.5">
            <label htmlFor="ev-type" className="text-sm font-medium">Type</label>
            <select id="ev-type" name="type" required defaultValue={v?.type ?? "festival"} className="h-12 rounded-md border border-border bg-surface px-4">
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
        </div>
        {area("description", "Description", v?.description, 4, true)}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organizer" name="organizerName" required defaultValue={v?.organizerName} error={errors.organizerName} />
          <Field label="Organizer contact (shown publicly)" name="organizerContact" defaultValue={v?.organizerContact ?? ""} error={errors.organizerContact} />
        </div>
        <SingleUpload label="Banner (optional)" purpose="event_banner" value={banner} onChange={setBanner} hint="Wide image, up to 8 MB." />
      </section>

      <section className={`${card} sm:grid-cols-2`} aria-labelledby="ev-place">
        <h2 id="ev-place" className="font-display font-semibold sm:col-span-2">Where and when</h2>
        <SelectField label="City" name="city" required options={PAKISTAN_CITIES} defaultValue={v?.city} error={errors.city} />
        <Field label="Venue" name="venue" required defaultValue={v?.venue} error={errors.venue} />
        <Field label="Venue address" name="venueAddress" className="sm:col-span-2" defaultValue={v?.venueAddress ?? ""} error={errors.venueAddress} />
        <Field label="Starts" name="startsAt" type="datetime-local" required defaultValue={local(v?.startsAt)} error={errors.startsAt} />
        <Field label="Ends (optional)" name="endsAt" type="datetime-local" defaultValue={local(v?.endsAt)} error={errors.endsAt} />
      </section>

      <section className={`${card} sm:grid-cols-2`} aria-labelledby="ev-reg">
        <h2 id="ev-reg" className="font-display font-semibold sm:col-span-2">Attendance</h2>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={needsReg} onChange={(e) => setNeedsReg(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          People must register to attend
        </label>
        {needsReg && (
          <>
            <Field label="Places (empty = no limit)" name="capacity" type="number" min={1} defaultValue={v?.capacity ?? ""} error={errors.capacity} hint="Counts guests too." />
            <Field label="Guests per registration" name="maxGuests" type="number" min={0} max={10} required defaultValue={v?.maxGuests ?? 2} error={errors.maxGuests} />
            <Field label="Registration closes (optional)" name="registrationClosesAt" type="datetime-local" defaultValue={local(v?.registrationClosesAt)} error={errors.registrationClosesAt} />
          </>
        )}
        <Field label="Fee (Rs, 0 = free)" name="fee" type="number" min={0} required defaultValue={v?.fee ?? 0} error={errors.fee} hint="Paid to the organizer at the venue." />
        <Field label="Tournament web address (optional)" name="tournamentSlug" defaultValue={v?.tournamentSlug ?? ""} error={errors.tournamentSlug} hint="e.g. lahore-spring-cup, if a tournament is held here." />
      </section>

      <section className={card} aria-labelledby="ev-safety">
        <h2 id="ev-safety" className="font-display font-semibold">Safety and rules</h2>
        {area("safetyNotes", "Safety notes", v?.safetyNotes ?? "Paper kites and plain cotton string only. No metal, glass-coated or chemical string. Fly only in the marked area, away from roads and power lines.", 3, true, "Shown on the event page. Only legally permitted events can be listed.")}
        {area("rules", "Rules (optional)", v?.rules, 3, false)}
      </section>

      <div><Button type="submit" size="lg" loading={pending}>{v?.id ? "Save changes" : "Create draft"}</Button></div>
    </form>
  );
}
