"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/app/actions/auth";
import { ResendCode } from "@/components/auth/resend-code";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { OTP_PATTERN, PASSWORD_HINT, PASSWORD_PATTERN } from "@/lib/validation";

export function ResetForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="email" value={email} />
      <Field label="Reset code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern={OTP_PATTERN} maxLength={6} required error={fe.code} />
      <PasswordField label="New password" name="newPassword" autoComplete="new-password" required pattern={PASSWORD_PATTERN} hint={PASSWORD_HINT} error={fe.newPassword} />
      <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" required error={fe.confirmPassword} />
      <Button type="submit" size="lg" loading={pending}>
        Update password
      </Button>
      <p className="text-center text-sm text-muted">You will be signed out on your other devices.</p>
      <ResendCode email={email} purpose="RESET_PASSWORD" />
    </form>
  );
}
