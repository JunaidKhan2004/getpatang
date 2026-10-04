"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setUserRolesAction, setUserStatusAction, verifyUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import type { RoleInfo } from "@/lib/admin";
import { useT } from "@/lib/i18n/client";

type Status = "ACTIVE" | "SUSPENDED" | "BANNED";
const box = "grid gap-3 rounded-md border border-border bg-surface p-5";

export function StatusActions({ id, status, isVerified }: { id: string; status: string; isVerified: boolean }) {
  const t = useT();
  const router = useRouter();
  const [next, setNext] = useState<Status | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const done = (res: { ok: boolean; message?: string }) => {
    if (res.ok) {
      toast.success(res.message);
      setNext(null);
      setReason("");
      router.refresh();
    } else toast.error(res.message);
  };

  const options: { s: Status; label: string; variant: "primary" | "secondary" | "danger" }[] = [
    ...(status !== "ACTIVE" ? [{ s: "ACTIVE" as const, label: t("Restore account"), variant: "primary" as const }] : []),
    ...(status !== "SUSPENDED" ? [{ s: "SUSPENDED" as const, label: t("Suspend"), variant: "secondary" as const }] : []),
    ...(status !== "BANNED" ? [{ s: "BANNED" as const, label: t("Ban"), variant: "danger" as const }] : []),
  ];

  return (
    <section className={box} aria-labelledby="access">
      <h2 id="access" className="font-display font-semibold">{t("Access")}</h2>
      {next ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => done(await setUserStatusAction(id, next, reason.trim()))); }}>
          <label htmlFor="status-reason" className="text-sm font-medium">{t("Reason (sent to the person)")}</label>
          <textarea id="status-reason" required minLength={5} maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant={next === "ACTIVE" ? "primary" : "danger"} loading={pending}>{t("Confirm")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setNext(null)}>{t("Back")}</Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => <Button key={o.s} size="sm" variant={o.variant} onClick={() => setNext(o.s)}>{o.label}</Button>)}
          {!isVerified && <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => done(await verifyUserAction(id)))}>{t("Mark email verified")}</Button>}
        </div>
      )}
      <p className="text-xs text-muted">{t("Suspending or banning signs the person out on every device straight away.")}</p>
    </section>
  );
}

export function RolesEditor({ id, current, roles, isSuperAdmin }: { id: string; current: string[]; roles: RoleInfo[]; isSuperAdmin: boolean }) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, start] = useTransition();
  const changed = roles.some((r) => r.assignable && selected.includes(r.key) !== current.includes(r.key));

  return (
    <section className={box} aria-labelledby="roles">
      <h2 id="roles" className="font-display font-semibold">{t("Staff roles")}</h2>
      <ul className="grid gap-2">
        {roles.filter((r) => r.assignable).map((r) => {
          const locked = r.protected && !isSuperAdmin;
          return (
            <li key={r.key}>
              <label className={`flex items-start gap-2 text-sm ${locked ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={selected.includes(r.key)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.key] : s.filter((k) => k !== r.key)))}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span>
                  <span className="font-medium">{r.name}</span>
                  {r.description && <span className="block text-xs text-muted">{r.description}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">{t("Seller and Customer roles come from shop approval and sign-up. Only a Super Admin can change admin roles.")}</p>
      <div>
        <Button
          size="sm"
          disabled={!changed}
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await setUserRolesAction(id, selected.filter((k) => roles.find((r) => r.key === k)?.assignable));
              if (res.ok) {
                toast.success(res.message);
                router.refresh();
              } else toast.error(res.message);
            })
          }
        >
          {t("Save roles")}</Button>
      </div>
    </section>
  );
}
