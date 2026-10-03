"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { resendCodeAction } from "@/app/actions/auth";

const COOLDOWN = 60;

export function ResendCode({ email, purpose }: { email: string; purpose: "VERIFY_ACCOUNT" | "RESET_PASSWORD" }) {
  const [seconds, setSeconds] = useState(COOLDOWN);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const resend = () =>
    startTransition(async () => {
      const res = await resendCodeAction(email, purpose);
      if (res.ok) {
        toast.success("A new code is on its way.");
        setSeconds(COOLDOWN);
      } else {
        toast.error(res.error ?? "Could not send a new code.");
      }
    });

  return (
    <button
      type="button"
      onClick={resend}
      disabled={seconds > 0 || pending}
      className="justify-self-center text-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
    >
      {seconds > 0 ? `Resend code in ${seconds}s` : pending ? "Sending…" : "Resend code"}
    </button>
  );
}
