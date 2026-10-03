import type { Metadata } from "next";

import { AuthHeading } from "@/components/auth/auth-heading";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Create your account" subtitle="We will email you a 6-digit code to verify your address." />
      <RegisterForm />
    </>
  );
}
