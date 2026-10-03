"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetSettingAction, saveSettingAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import type { SettingRow } from "@/lib/admin";

const input = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

type Delivery = { key: string; label: string; description: string; fee: number; freeAbove: number | null };
type Bank = { enabled: boolean; bankName: string; accountTitle: string; iban: string };
type Points = { placement: Record<string, number>; participation: number; perWin: number };

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function SettingEditor({ setting }: { setting: SettingRow }) {
  const router = useRouter();
  const [value, setValue] = useState<unknown>(setting.value);
  const [text, setText] = useState(Array.isArray(setting.value) && setting.key === "products.banned_keywords" ? (setting.value as string[]).join("\n") : "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const v = setting.key === "products.banned_keywords" ? text.split("\n").map((w) => w.trim()).filter(Boolean) : value;
      const res = await saveSettingAction(setting.key, v);
      setError(res.ok ? undefined : res.message);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  const reset = () =>
    start(async () => {
      if (!window.confirm("Go back to the default value?")) return;
      const res = await resetSettingAction(setting.key);
      if (res.ok) {
        toast.success(res.message);
        window.location.reload();
      } else toast.error(res.message);
    });

  let editor: React.ReactNode;
  switch (setting.key) {
    case "products.require_approval":
      editor = <Toggle checked={value as boolean} onChange={setValue} label="New and edited products wait for approval" />;
      break;
    case "payments.cod":
      editor = <Toggle checked={(value as { enabled: boolean }).enabled} onChange={(enabled) => setValue({ enabled })} label="Offer cash on delivery" />;
      break;
    case "community.auto_hide_reports":
    case "marketplace.commission_percent":
      editor = (
        <input
          type="number"
          aria-label={setting.label}
          step={setting.key === "marketplace.commission_percent" ? 0.1 : 1}
          min={setting.key === "marketplace.commission_percent" ? 0 : 2}
          max={setting.key === "marketplace.commission_percent" ? 50 : 100}
          value={String(value)}
          onChange={(e) => setValue(num(e.target.value))}
          className={`${input} max-w-40`}
        />
      );
      break;
    case "payments.bank_transfer": {
      const b = value as Bank;
      const set = (patch: Partial<Bank>) => setValue({ ...b, ...patch });
      editor = (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3"><Toggle checked={b.enabled} onChange={(enabled) => set({ enabled })} label="Offer bank transfer" /></div>
          <label className="grid gap-1 text-sm">Bank<input value={b.bankName} onChange={(e) => set({ bankName: e.target.value })} className={input} /></label>
          <label className="grid gap-1 text-sm">Account title<input value={b.accountTitle} onChange={(e) => set({ accountTitle: e.target.value })} className={input} /></label>
          <label className="grid gap-1 text-sm">IBAN<input value={b.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="PK36SCBL0000001123456702" className={input} /></label>
        </div>
      );
      break;
    }
    case "checkout.delivery_methods": {
      const list = value as Delivery[];
      const set = (i: number, patch: Partial<Delivery>) => setValue(list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
      editor = (
        <div className="grid gap-3">
          {list.map((m, i) => (
            <fieldset key={i} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[120px_1fr_1fr_110px_130px_auto] sm:items-end">
              <legend className="sr-only">Delivery method {i + 1}</legend>
              <label className="grid gap-1 text-xs text-muted">Key<input value={m.key} onChange={(e) => set(i, { key: e.target.value })} className={input} /></label>
              <label className="grid gap-1 text-xs text-muted">Label<input value={m.label} onChange={(e) => set(i, { label: e.target.value })} className={input} /></label>
              <label className="grid gap-1 text-xs text-muted">Description<input value={m.description} onChange={(e) => set(i, { description: e.target.value })} className={input} /></label>
              <label className="grid gap-1 text-xs text-muted">Fee (Rs)<input type="number" min={0} value={String(m.fee)} onChange={(e) => set(i, { fee: num(e.target.value) })} className={input} /></label>
              <label className="grid gap-1 text-xs text-muted">Free above (Rs)<input type="number" min={1} value={m.freeAbove === null ? "" : String(m.freeAbove)} placeholder="Never" onChange={(e) => set(i, { freeAbove: e.target.value ? num(e.target.value) : null })} className={input} /></label>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${m.label || "method"}`} disabled={list.length === 1} onClick={() => setValue(list.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </fieldset>
          ))}
          {list.length < 5 && (
            <div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setValue([...list, { key: "", label: "", description: "", fee: 0, freeAbove: null }])}>
                <Plus className="size-4" aria-hidden="true" /> Add method
              </Button>
            </div>
          )}
        </div>
      );
      break;
    }
    case "rankings.points": {
      const p = value as Points;
      const rows = Object.entries(p.placement).sort((a, b) => Number(a[0]) - Number(b[0]));
      const setPlacement = (entries: [string, number][]) => setValue({ ...p, placement: Object.fromEntries(entries) });
      editor = (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {rows.map(([place, pts], i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="grid gap-1 text-xs text-muted">Place<input type="number" min={1} value={place} onChange={(e) => setPlacement(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} className={`${input} w-20`} /></label>
                <label className="grid gap-1 text-xs text-muted">Points<input type="number" min={0} value={String(pts)} onChange={(e) => setPlacement(rows.map((r, j) => (j === i ? [r[0], num(e.target.value)] : r)))} className={`${input} w-24`} /></label>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Places are bracket finishes: 1 champion, 2 runner-up, 3 semi-finalists, 5 quarter-finalists, 9 last 16, 17 last 32.</p>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1 text-xs text-muted">For taking part<input type="number" min={0} value={String(p.participation)} onChange={(e) => setValue({ ...p, participation: num(e.target.value) })} className={`${input} w-28`} /></label>
            <label className="grid gap-1 text-xs text-muted">Per match won<input type="number" min={0} value={String(p.perWin)} onChange={(e) => setValue({ ...p, perWin: num(e.target.value) })} className={`${input} w-28`} /></label>
          </div>
        </div>
      );
      break;
    }
    case "products.banned_keywords":
      editor = (
        <div className="grid gap-2">
          <label htmlFor="banned" className="text-sm font-medium">One word or phrase per line</label>
          <textarea id="banned" rows={8} value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm" />
          {setting.required && <p className="text-xs text-muted">Always kept: {setting.required.join(", ")}.</p>}
        </div>
      );
      break;
    default:
      editor = <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }

  return (
    <div className="grid gap-3">
      {editor}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} onClick={save}>Save</Button>
        {!setting.isDefault && <Button size="sm" variant="secondary" disabled={pending} onClick={reset}>Use default</Button>}
      </div>
    </div>
  );
}
