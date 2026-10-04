import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";

import { ResetForm } from "./reset-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Choose a new password") };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const t = await getT();
  const { email } = await searchParams;
  if (!email) redirect("/forgot-password");
  return (
    <>
      <AuthHeading
        title={t("Choose a new password")}
        subtitle={t("If {email} has an account, we sent it a 6-digit code. Enter it below with your new password.", { email })}
      />
      <ResetForm email={email} />
    </>
  );
}
