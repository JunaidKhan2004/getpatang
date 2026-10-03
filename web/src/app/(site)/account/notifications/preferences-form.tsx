"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { savePreferencesAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import type { NotificationPreferences } from "@/lib/notifications";

type Channel = "inApp" | "email" | "push";

export function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [rows, setRows] = useState(initial.categories);
  const [pending, start] = useTransition();
  const channels: { key: Channel; label: string }[] = [
    { key: "inApp", label: "In app" },
    { key: "email", label: "Email" },
    ...(initial.channels.push ? [{ key: "push" as const, label: "Push" }] : []),
  ];

  const toggle = (key: string, ch: Channel) => setRows((r) => r.map((c) => (c.key === key ? { ...c, [ch]: !c[ch] } : c)));

  const save = () =>
    start(async () => {
      const prefs = Object.fromEntries(rows.map((c) => [c.key, { inApp: c.inApp, email: c.email, push: c.push }]));
      const res = await savePreferencesAction(prefs);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Notification channels for each category</caption>
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Updates about</th>
              {channels.map((c) => <th key={c.key} scope="col" className="px-4 py-3 text-center font-semibold">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.key}>
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block font-medium">{c.label}</span>
                  <span className="text-xs text-muted">{c.description}</span>
                </th>
                {channels.map((ch) => (
                  <td key={ch.key} className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={c[ch.key]}
                      onChange={() => toggle(c.key, ch.key)}
                      aria-label={`${c.label}: ${ch.label}`}
                      className="size-4 accent-[var(--primary)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!initial.channels.push && <p className="text-xs text-muted">Phone push notifications will be added here once the mobile app can receive them.</p>}
      <div><Button loading={pending} onClick={save}>Save settings</Button></div>
    </div>
  );
}
