"use client";

import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import type { FormState } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {} as FormState);
  return (
    <>
      <AuthHeading title="Reset your password" subtitle="Enter the email on your account. If it exists, we will send a reset code." />
      <form action={action} className="grid gap-5">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
        <Button type="submit" size="lg" loading={pending}>
          Send reset code
        </Button>
        <Link href="/login" className="justify-self-center text-sm font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      </form>
    </>
  );
}
