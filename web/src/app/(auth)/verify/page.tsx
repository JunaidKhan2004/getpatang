import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert } from "@/components/ui/feedback";

import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; notice?: string; next?: string }>;
}) {
  const { email, notice, next } = await searchParams;
  if (!email) redirect("/register");
  return (
    <>
      <AuthHeading title="Check your email" subtitle={`Enter the 6-digit code we sent to ${email}. It expires in 10 minutes.`} />
      {notice === "unverified" && (
        <div className="mb-6">
          <Alert>Your email is not verified yet. Enter the code we sent, or request a new one.</Alert>
        </div>
      )}
      <VerifyForm email={email} next={next ?? ""} />
    </>
  );
}
