import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert } from "@/components/ui/feedback";

import { LoginForm } from "./login-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign in") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const t = await getT();
  const { next, notice } = await searchParams;
  return (
    <>
      <AuthHeading title={t("Welcome back")} subtitle={t("Sign in to manage your orders, tournaments and shop.")} />
      {notice === "password-reset" && (
        <div className="mb-6">
          <Alert tone="success">{t("Your password was updated. Sign in with your new password.")}</Alert>
        </div>
      )}
      <LoginForm next={next ?? ""} />
    </>
  );
}
