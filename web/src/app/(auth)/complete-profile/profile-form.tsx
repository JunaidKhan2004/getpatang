"use client";

import { useActionState } from "react";

import { saveProfileAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, SelectField } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { PAKISTAN_CITIES } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

export function ProfileForm({ defaultName, next }: { defaultName: string; next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveProfileAction, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label={t("Display name")} name="displayName" required minLength={2} maxLength={40} defaultValue={state.values?.displayName ?? defaultName} error={fe.displayName} />
      <SelectField label={t("City")} name="city" required options={PAKISTAN_CITIES} defaultValue={state.values?.city} error={fe.city} />
      <div className="grid gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">{t("Short bio (optional)")}</label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={160}
          defaultValue={state.values?.bio}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {fe.bio && <p className="text-sm text-danger">{fe.bio}</p>}
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {t("Continue")}</Button>
    </form>
  );
}
