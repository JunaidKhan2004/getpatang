"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTournamentAction } from "@/app/actions/tournaments";
import { type Uploaded, SingleUpload } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import { PAKISTAN_CITIES } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

export interface TournamentFormValues {
  id?: string;
  name: string;
  description: string;
  city: string;
  venue: string;
  venueAddress: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  maxParticipants: number;
  minAge: number;
  entryFee: number;
  prizeInfo: string | null;
  rules: string;
  safetyRules: string;
  approvedMaterials: string;
  venueRestrictions: string | null;
  permitReference: string | null;
  organizerName: string;
  organizerContact: string | null;
  season: string;
  bannerUrl: string | null;
}

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
const local = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const textarea = "w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function TournamentForm({ initial }: { initial: TournamentFormValues | null }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [banner, setBanner] = useState<Uploaded | null>(initial?.bannerUrl ? { id: "", url: initial.bannerUrl, originalName: t("Current banner") } : null);
  const v = initial;

  const submit = (fd: FormData) => {
    const str = (k: string) => String(fd.get(k) ?? "").trim();
    const iso = (k: string) => (str(k) ? new Date(str(k)).toISOString() : undefined);
    const body = {
      name: str("name"),
      description: str("description"),
      city: str("city"),
      venue: str("venue"),
      venueAddress: str("venueAddress") || undefined,
      startsAt: iso("startsAt"),
      endsAt: iso("endsAt"),
      registrationOpensAt: iso("registrationOpensAt"),
      registrationClosesAt: iso("registrationClosesAt"),
      maxParticipants: Number(str("maxParticipants")),
      minAge: Number(str("minAge")),
      entryFee: Number(str("entryFee") || 0),
      prizeInfo: str("prizeInfo") || undefined,
      rules: str("rules"),
      safetyRules: str("safetyRules"),
      approvedMaterials: str("approvedMaterials"),
      venueRestrictions: str("venueRestrictions") || undefined,
      permitReference: str("permitReference") || undefined,
      organizerName: str("organizerName"),
      organizerContact: str("organizerContact") || undefined,
      season: str("season"),
      bannerUploadId: banner?.id ? banner.id : !banner && v?.bannerUrl ? null : undefined,
    };
    start(async () => {
      const res = await saveTournamentAction(v?.id ?? null, body);
      setErrors(res.fieldErrors ?? {});
      if (!res.ok) {
        setFormError(res.message);
        toast.error(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast.success(res.message);
      if (!v?.id && res.id) router.push(`/admin/tournaments/${res.id}`);
      else router.refresh();
    });
  };

  const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
  return (
    <form action={submit} className="grid gap-6">
      {formError && <Alert tone="error">{formError}</Alert>}

      <section className={card} aria-labelledby="t-basics">
        <h2 id="t-basics" className="font-display font-semibold">{t("Event")}</h2>
        <Field label={t("Name")} name="name" required minLength={5} maxLength={100} defaultValue={v?.name} error={errors.name} />
        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">{t("Description")}</label>
          <textarea id="description" name="description" required minLength={30} rows={4} defaultValue={v?.description} className={textarea} />
          {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Organizer")} name="organizerName" required defaultValue={v?.organizerName} error={errors.organizerName} />
          <Field label={t("Organizer contact (shown publicly)")} name="organizerContact" defaultValue={v?.organizerContact ?? ""} error={errors.organizerContact} />
          <Field label={t("Season")} name="season" required pattern="[0-9]{4}" defaultValue={v?.season ?? String(new Date().getFullYear())} error={errors.season} />
          <Field label={t("Prize (optional)")} name="prizeInfo" defaultValue={v?.prizeInfo ?? ""} error={errors.prizeInfo} />
        </div>
        <SingleUpload label={t("Banner (optional)")} purpose="tournament_banner" value={banner} onChange={setBanner} hint={t("Wide image, up to 5 MB.")} />
      </section>

      <section className={`${card} sm:grid-cols-2`} aria-labelledby="t-place">
        <h2 id="t-place" className="font-display font-semibold sm:col-span-2">{t("Where and when")}</h2>
        <SelectField label={t("City")} name="city" required options={PAKISTAN_CITIES} defaultValue={v?.city} error={errors.city} />
        <Field label={t("Venue")} name="venue" required defaultValue={v?.venue} error={errors.venue} />
        <Field label={t("Venue address")} name="venueAddress" className="sm:col-span-2" defaultValue={v?.venueAddress ?? ""} error={errors.venueAddress} />
        <Field label={t("Starts")} name="startsAt" type="datetime-local" required defaultValue={local(v?.startsAt)} error={errors.startsAt} />
        <Field label={t("Ends (optional)")} name="endsAt" type="datetime-local" defaultValue={local(v?.endsAt)} error={errors.endsAt} />
        <Field label={t("Registration opens")} name="registrationOpensAt" type="datetime-local" required defaultValue={local(v?.registrationOpensAt)} error={errors.registrationOpensAt} />
        <Field label={t("Registration closes")} name="registrationClosesAt" type="datetime-local" required defaultValue={local(v?.registrationClosesAt)} error={errors.registrationClosesAt} />
      </section>

      <section className={`${card} sm:grid-cols-3`} aria-labelledby="t-entry">
        <h2 id="t-entry" className="font-display font-semibold sm:col-span-3">{t("Entry")}</h2>
        <Field label={t("Player limit")} name="maxParticipants" type="number" min={2} max={256} required defaultValue={v?.maxParticipants ?? 16} error={errors.maxParticipants} />
        <Field label={t("Minimum age")} name="minAge" type="number" min={8} max={99} required defaultValue={v?.minAge ?? 16} error={errors.minAge} />
        <Field label={t("Entry fee (Rs, 0 = free)")} name="entryFee" type="number" min={0} required defaultValue={v?.entryFee ?? 0} error={errors.entryFee} hint={t("Collected by the organizer; mark players confirmed when paid.")} />
      </section>

      <section className={card} aria-labelledby="t-rules">
        <h2 id="t-rules" className="font-display font-semibold">{t("Rules, safety and compliance")}</h2>
        {[
          { name: "rules", label: t("Competition rules"), value: v?.rules, rows: 5, required: true },
          { name: "safetyRules", label: t("Safety rules"), value: v?.safetyRules, rows: 4, required: true },
          { name: "approvedMaterials", label: t("Approved materials"), value: v?.approvedMaterials ?? "Paper kites and plain cotton string only. No metal, glass-coated or chemical string.", rows: 2, required: true },
          { name: "venueRestrictions", label: t("Venue restrictions (optional)"), value: v?.venueRestrictions, rows: 2, required: false },
        ].map((f) => (
          <div key={f.name} className="grid gap-1.5">
            <label htmlFor={f.name} className="text-sm font-medium">{f.label}</label>
            <textarea id={f.name} name={f.name} required={f.required} rows={f.rows} defaultValue={f.value ?? ""} className={textarea} />
            {errors[f.name] && <p className="text-sm text-danger">{errors[f.name]}</p>}
          </div>
        ))}
        <Field
          label={t("Local authority permission reference")}
          name="permitReference"
          defaultValue={v?.permitReference ?? ""}
          error={errors.permitReference}
          hint={t("Required before publishing. Only legally permitted events can be listed.")}
        />
      </section>

      <div><Button type="submit" size="lg" loading={pending}>{v?.id ? t("Save changes") : t("Create draft")}</Button></div>
    </form>
  );
}
