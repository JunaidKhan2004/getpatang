import type { Metadata } from "next";
import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Logo } from "@/components/ui/kite-mark";
import { api } from "@/lib/api";
import type { SellerApplication } from "@/lib/seller";
import { getAccessToken, requireUser } from "@/lib/session";

import { ApplicationGate } from "./application-gate";

export const metadata: Metadata = { title: { default: "Seller", template: "%s · Seller · Kite Platform" } };

/** UI gate only. Every seller API call is authorised again by the backend. */
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/seller");
  const application = await api<SellerApplication | null>("/seller/application", { token: await getAccessToken() });

  if (!application || application.status !== "APPROVED") {
    return (
      <div className="min-h-dvh bg-bg">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
            <Link href="/" aria-label="Kite Platform home"><Logo /></Link>
            <Link href="/account" className="text-sm font-medium text-primary hover:underline">My account</Link>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <ApplicationGate application={application} defaults={{ email: user.email, phone: user.phone ?? "", city: user.profile?.city ?? "" }} />
        </main>
      </div>
    );
  }

  return (
    <DashboardShell area="seller" userName={application.name}>
      {children}
    </DashboardShell>
  );
}
