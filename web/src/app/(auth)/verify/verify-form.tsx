"use client";

import { useActionState } from "react";

import { verifyAction } from "@/app/actions/auth";
import { ResendCode } from "@/components/auth/resend-code";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { OTP_PATTERN } from "@/lib/validation";
import { useT } from "@/lib/i18n/client";

export function VerifyForm({ email, next }: { email: string; next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(verifyAction, {} as FormState);
  return (
    <form action={action} className="grid gap-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Field
        label={t("Verification code")}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={OTP_PATTERN}
        maxLength={6}
        required
        autoFocus
        className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        error={state.fieldErrors?.code}
      />
      <Button type="submit" size="lg" loading={pending}>
        {t("Verify and continue")}</Button>
      <ResendCode email={email} purpose="VERIFY_ACCOUNT" />
    </form>
  );
}
