"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { PASSWORD_HINT, PASSWORD_PATTERN, PK_PHONE_PATTERN } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

export function RegisterForm() {
  const t = useT();
  const [state, action, pending] = useActionState(registerAction, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label={t("Full name")} name="fullName" autoComplete="name" required minLength={2} maxLength={80} defaultValue={state.values?.fullName} error={fe.fullName} />
      <Field label={t("Email")} name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={fe.email} />
      <Field
        label={t("Mobile number (optional)")}
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder={t("03XX XXXXXXX")}
        pattern={PK_PHONE_PATTERN}
        defaultValue={state.values?.phone}
        error={fe.phone}
      />
      <PasswordField label={t("Password")} name="password" autoComplete="new-password" required pattern={PASSWORD_PATTERN} hint={PASSWORD_HINT} error={fe.password} />
      <PasswordField label={t("Confirm password")} name="confirmPassword" autoComplete="new-password" required error={fe.confirmPassword} />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          {t("I agree to the{value}", { value: " " })}
          <Link href="/terms" className="font-semibold text-primary hover:underline">{t("Terms")}</Link> {" "}{t("and{value}", { value: " " })}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">{t("Privacy Policy")}</Link>{t(", and I will follow local kite-flying laws.")}</span>
      </label>
      <Button type="submit" size="lg" loading={pending}>
        {t("Create account")}</Button>
      <p className="text-center text-sm text-muted">
        {t("Already registered?{value}", { value: " " })}
        <Link href="/login" className="font-semibold text-primary hover:underline">{t("Sign in")}</Link>
      </p>
    </form>
  );
}
