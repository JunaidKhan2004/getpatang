import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { NotificationPreferences } from "@/lib/notifications";
import { getAccessToken, requireUser } from "@/lib/session";

import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  await requireUser("/account/notifications");
  const prefs = await api<NotificationPreferences>("/notifications/preferences", { token: await getAccessToken() }).catch(() => null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-muted"><Link href="/account" className="hover:text-primary">Account</Link> / Notifications</nav>
      <h1 className="mb-2 text-3xl font-bold">Notification settings</h1>
      <p className="mb-6 text-muted">Choose how we tell you about each kind of update. Security messages, like sign-in codes, are always sent.</p>
      {prefs ? <PreferencesForm initial={prefs} /> : <Alert tone="error">Settings could not load. Please refresh the page.</Alert>}
    </div>
  );
}
