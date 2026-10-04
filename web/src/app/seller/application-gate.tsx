"use client";

import { Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitApplicationAction } from "@/app/actions/seller";
import { type Uploaded, SingleUpload } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";

import { DOCUMENT_LABEL, PAYOUT_METHODS, type SellerApplication, SHOP_STATUS_LABEL, SHOP_STATUS_TONE } from "@/lib/seller";
import { PAKISTAN_CITIES, PK_PHONE_PATTERN } from "@/lib/validation";
import { useT, useFormat } from "@/lib/i18n/client";

function StatusCard({ app, onEdit }: { app: SellerApplication; onEdit: () => void }) {
  const { formatDate } = useFormat();
  const t = useT();
  const icon =
    app.status === "REJECTED" || app.status === "SUSPENDED" ? (
      <ShieldAlert className="size-10 text-danger" aria-hidden="true" />
    ) : (
      <Clock className="size-10 text-primary" aria-hidden="true" />
    );
  const text: Record<string, string> = {
    PENDING: "Thanks for applying. Our team checks every shop by hand, usually within 2 working days. We will email you when there is a decision.",
    UNDER_REVIEW: "A reviewer is checking your details and documents right now.",
    REJECTED: "Your application needs a few changes before it can be approved. Fix the points below and send it again.",
    SUSPENDED: "Your shop is suspended and its products are hidden from customers. Please contact support to resolve this.",
  };
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        {icon}
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold">{app.name}</h1>
          <Badge tone={SHOP_STATUS_TONE[app.status]}>{t(SHOP_STATUS_LABEL[app.status])}</Badge>
        </div>
      </div>
      <p className="text-muted">{t(text[app.status])}</p>
      {app.reviewNote && (
        <Alert tone="error">
          <strong>{t("Note from our team:")}</strong> {app.reviewNote}
        </Alert>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {app.submittedAt && <div><dt className="text-muted">{t("Submitted")}</dt><dd>{formatDate(app.submittedAt, true)}</dd></div>}
        {app.reviewedAt && <div><dt className="text-muted">{t("Last reviewed")}</dt><dd>{formatDate(app.reviewedAt, true)}</dd></div>}
        <div><dt className="text-muted">{t("City")}</dt><dd>{app.city}</dd></div>
        <div><dt className="text-muted">{t("Documents")}</dt><dd>{app.documents.map((d) => t(DOCUMENT_LABEL[d.type]) ?? d.type).join(", ")}</dd></div>
      </dl>
      {(app.status === "PENDING" || app.status === "REJECTED") && (
        <div><Button variant={app.status === "REJECTED" ? "primary" : "secondary"} onClick={onEdit}>{app.status === "REJECTED" ? t("Fix and resubmit") : t("Edit application")}</Button></div>
      )}
    </section>
  );
}

export function ApplicationGate({
  application,
  defaults,
}: {
  application: SellerApplication | null;
  defaults: { email: string; phone: string; city: string };
}) {
  const [editing, setEditing] = useState(!application);
  if (application && !editing) return <StatusCard app={application} onEdit={() => setEditing(true)} />;
  return <ApplicationForm application={application} defaults={defaults} onDone={() => setEditing(false)} />;
}

function ApplicationForm({
  application: a,
  defaults,
  onDone,
}: {
  application: SellerApplication | null;
  defaults: { email: string; phone: string; city: string };
  onDone: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const doc = (type: string): Uploaded | null => {
    const d = a?.documents.find((x) => x.type === type);
    return d ? { id: d.id, url: null, originalName: d.originalName } : null;
  };
  const [logo, setLogo] = useState<Uploaded | null>(null);
  const [cnicFront, setCnicFront] = useState<Uploaded | null>(doc("cnic_front"));
  const [cnicBack, setCnicBack] = useState<Uploaded | null>(doc("cnic_back"));
  const [registration, setRegistration] = useState<Uploaded | null>(doc("business_registration"));

  const submit = (fd: FormData) => {
    if (!cnicFront || !cnicBack) {
      setErrors({ documents: t("Upload both sides of your CNIC") });
      toast.error(t("Upload both sides of your CNIC."));
      return;
    }
    const body = {
      ...Object.fromEntries(["shopName", "description", "phone", "email", "city", "address", "cnicNumber", "payoutMethod", "payoutAccountTitle", "payoutAccountNumber"].map((k) => [k, String(fd.get(k) ?? "")])),
      logoUploadId: logo?.id,
      documents: [
        { type: "cnic_front", uploadId: cnicFront.id },
        { type: "cnic_back", uploadId: cnicBack.id },
        ...(registration ? [{ type: "business_registration", uploadId: registration.id }] : []),
      ],
    };
    start(async () => {
      const res = await submitApplicationAction(body);
      setErrors(res.fieldErrors ?? {});
      if (res.ok) {
        toast.success(res.message);
        onDone();
        router.refresh();
      } else toast.error(res.message);
    });
  };

  const section = "grid gap-4 rounded-lg border border-border bg-surface p-6";
  return (
    <form action={submit} className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{a ? t("Update your application") : t("Sell on GetPatang")}</h1>
        <p className="text-muted">{t("Tell us about your shop. We review every application by hand to keep buyers safe.")}</p>
      </div>
      {a?.reviewNote && <Alert tone="error"><strong>{t("Please fix:")}</strong> {a.reviewNote}</Alert>}

      <section className={section} aria-labelledby="s1">
        <h2 id="s1" className="text-lg font-semibold">{t("Your shop")}</h2>
        <Field label={t("Shop name")} name="shopName" required minLength={3} maxLength={60} defaultValue={a?.name} error={errors.shopName} hint={t("This becomes your shop’s web address and cannot be changed after approval.")} />
        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">{t("What do you sell?")}</label>
          <textarea id="description" name="description" required minLength={20} maxLength={1000} rows={4} defaultValue={a?.description ?? ""} className="rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
        </div>
        <SingleUpload label={t("Shop logo (optional)")} purpose="shop_logo" value={logo} onChange={setLogo} hint={a?.logoUrl ? t("Leave empty to keep your current logo.") : t("Square image, up to 2 MB.")} />
      </section>

      <section className={`${section} sm:grid-cols-2`} aria-labelledby="s2">
        <h2 id="s2" className="text-lg font-semibold sm:col-span-2">{t("Contact and location")}</h2>
        <Field label={t("Shop phone")} name="phone" type="tel" required pattern={PK_PHONE_PATTERN} placeholder={t("03XX XXXXXXX")} defaultValue={a?.phone ?? defaults.phone} error={errors.phone} />
        <Field label={t("Shop email")} name="email" type="email" required defaultValue={a?.email ?? defaults.email} error={errors.email} />
        <SelectField label={t("City")} name="city" required options={PAKISTAN_CITIES} defaultValue={a?.city ?? defaults.city} error={errors.city} />
        <Field label={t("Shop address")} name="address" required minLength={5} defaultValue={a?.address ?? ""} error={errors.address} />
      </section>

      <section className={section} aria-labelledby="s3">
        <h2 id="s3" className="text-lg font-semibold">{t("Identity verification")}</h2>
        <p className="text-sm text-muted">{t("Only our review team can see these documents. They are never shown to customers.")}</p>
        <Field label={t("Owner’s CNIC number")} name="cnicNumber" required inputMode="numeric" placeholder="35202-1234567-1" pattern="[0-9]{5}-?[0-9]{7}-?[0-9]" defaultValue={a?.cnicNumber ?? ""} error={errors.cnicNumber} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SingleUpload label={t("CNIC front")} purpose="seller_document" value={cnicFront} onChange={setCnicFront} required />
          <SingleUpload label={t("CNIC back")} purpose="seller_document" value={cnicBack} onChange={setCnicBack} required />
        </div>
        <SingleUpload label={t("Business registration (optional)")} purpose="seller_document" value={registration} onChange={setRegistration} hint={t("NTN or chamber registration if you have one. JPG, PNG or PDF up to 10 MB.")} />
        {errors.documents && <p className="text-sm text-danger">{errors.documents}</p>}
      </section>

      <section className={`${section} sm:grid-cols-2`} aria-labelledby="s4">
        <h2 id="s4" className="text-lg font-semibold sm:col-span-2">{t("How you get paid")}</h2>
        <div className="grid gap-1.5">
          <label htmlFor="payoutMethod" className="text-sm font-medium">{t("Payout method")}</label>
          <select id="payoutMethod" name="payoutMethod" required defaultValue={a?.payoutMethod ?? "bank"} className="h-12 rounded-md border border-border bg-surface px-4">
            {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
          </select>
        </div>
        <Field label={t("Account title")} name="payoutAccountTitle" required defaultValue={a?.payoutAccountTitle ?? ""} error={errors.payoutAccountTitle} />
        <Field label={t("IBAN or wallet number")} name="payoutAccountNumber" required placeholder={t("PK36SCBL… or 03XX…")} className="sm:col-span-2" defaultValue={a?.payoutAccountNumber ?? ""} error={errors.payoutAccountNumber} />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={pending}>
          <ShieldCheck className="size-4" aria-hidden="true" /> {a ? t("Resubmit application") : t("Submit application")}
        </Button>
        {a && <Button type="button" variant="secondary" onClick={onDone}>{t("Cancel")}</Button>}
        <p className="text-sm text-muted">{t("By applying you agree to sell only items allowed by law. Metal, glass-coated and chemical strings are banned.")}</p>
      </div>
    </form>
  );
}
