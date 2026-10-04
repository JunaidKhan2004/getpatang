import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/auth-heading";

import { RegisterForm } from "./register-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Create account") };
}

export default async function RegisterPage() {
  const t = await getT();
  return (
    <>
      <AuthHeading title={t("Create your account")} subtitle={t("We will email you a 6-digit code to verify your address.")} />
      <RegisterForm />
    </>
  );
}
