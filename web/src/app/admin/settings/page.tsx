import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Alert } from "@/components/ui/feedback";
import type { SettingRow } from "@/lib/admin";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { SettingEditor } from "./setting-editor";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await api<SettingRow[]>("/admin/settings", { token: await getAccessToken() }).catch(() => null);
  const groups = settings ? [...new Set(settings.map((s) => s.group))] : [];

  return (
    <>
      <PageHeader title="Settings" description="Platform rules that change without a new release. Every change is checked and recorded in the audit log." />
      {!settings && <Alert tone="error">Settings could not load. You may not have permission to change them.</Alert>}
      <div className="grid gap-8">
        {groups.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="grid gap-4">
            <h2 id={`g-${g}`} className="text-lg font-semibold">{g}</h2>
            {settings!.filter((s) => s.group === g).map((s) => (
              <article key={s.key} className="grid gap-3 rounded-md border border-border bg-surface p-5">
                <header className="grid gap-0.5">
                  <h3 className="font-display font-semibold">{s.label}</h3>
                  <p className="text-sm text-muted">{s.description}</p>
                  <p className="text-xs text-muted">{s.isDefault ? "Using the default" : `Changed${s.updatedBy ? ` by ${s.updatedBy}` : ""}${s.updatedAt ? ` on ${formatDate(s.updatedAt, true)}` : ""}`}</p>
                </header>
                <SettingEditor setting={s} />
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
