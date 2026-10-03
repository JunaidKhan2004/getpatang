"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { PASSWORD_HINT, PASSWORD_PATTERN, PK_PHONE_PATTERN } from "@/lib/validation";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full name" name="fullName" autoComplete="name" required minLength={2} maxLength={80} defaultValue={state.values?.fullName} error={fe.fullName} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={fe.email} />
      <Field
        label="Mobile number (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="03XX XXXXXXX"
        pattern={PK_PHONE_PATTERN}
        defaultValue={state.values?.phone}
        error={fe.phone}
      />
      <PasswordField label="Password" name="password" autoComplete="new-password" required pattern={PASSWORD_PATTERN} hint={PASSWORD_HINT} error={fe.password} />
      <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" required error={fe.confirmPassword} />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>, and I will follow local
          kite-flying laws.
        </span>
      </label>
      <Button type="submit" size="lg" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
