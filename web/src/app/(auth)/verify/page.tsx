import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert } from "@/components/ui/feedback";

import { VerifyForm } from "./verify-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Verify email") };
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; notice?: string; next?: string }>;
}) {
  const t = await getT();
  const { email, notice, next } = await searchParams;
  if (!email) redirect("/register");
  return (
    <>
      <AuthHeading title={t("Check your email")} subtitle={t("Enter the 6-digit code we sent to {email}. It expires in 10 minutes.", { email })} />
      {notice === "unverified" && (
        <div className="mb-6">
          <Alert>{t("Your email is not verified yet. Enter the code we sent, or request a new one.")}</Alert>
        </div>
      )}
      <VerifyForm email={email} next={next ?? ""} />
    </>
  );
}
