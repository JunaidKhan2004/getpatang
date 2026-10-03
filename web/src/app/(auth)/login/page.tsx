import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/auth-heading";
import { Alert } from "@/components/ui/feedback";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams;
  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Sign in to manage your orders, tournaments and shop." />
      {notice === "password-reset" && (
        <div className="mb-6">
          <Alert tone="success">Your password was updated. Sign in with your new password.</Alert>
        </div>
      )}
      <LoginForm next={next ?? ""} />
    </>
  );
}
