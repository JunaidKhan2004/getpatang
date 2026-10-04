"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import type { FormState } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

export function LoginForm({ next }: { next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(loginAction, {} as FormState);
  return (
    <form action={action} className="grid gap-5" noValidate={false}>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field
        label={t("Email or phone")}
        name="identifier"
        autoComplete="username"
        required
        defaultValue={state.values?.identifier}
        error={state.fieldErrors?.identifier}
      />
      <div className="grid gap-2">
        <PasswordField label={t("Password")} name="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
        <Link href="/forgot-password" className="justify-self-end text-sm font-medium text-primary hover:underline">
          {t("Forgot password?")}</Link>
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {t("Sign in")}</Button>
      <p className="text-center text-sm text-muted">
        {t("New here?{value}", { value: " " })}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-primary hover:underline">
          {t("Create an account")}</Link>
      </p>
    </form>
  );
}
