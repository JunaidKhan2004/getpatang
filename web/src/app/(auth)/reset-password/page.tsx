import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  if (!email) redirect("/forgot-password");
  return (
    <>
      <AuthHeading
        title="Choose a new password"
        subtitle={`If ${email} has an account, we sent it a 6-digit code. Enter it below with your new password.`}
      />
      <ResetForm email={email} />
    </>
  );
}
