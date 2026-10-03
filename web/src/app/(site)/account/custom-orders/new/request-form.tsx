"use client";

import { BadgeCheck, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCustomOrderAction } from "@/app/actions/custom-orders";
import { KitePreview } from "@/components/designer/kite-preview";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import type { CustomShop, SavedDesign } from "@/lib/designer";

export function RequestForm({ designs, shops, initialDesign, initialShop }: { designs: SavedDesign[]; shops: CustomShop[]; initialDesign: string; initialShop?: string }) {
  const router = useRouter();
  const [designId, setDesignId] = useState(initialDesign);
  const [shopId, setShopId] = useState(initialShop ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();
  const design = designs.find((d) => d.id === designId)!;
  const [tomorrow] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));

  const submit = (fd: FormData) =>
    start(async () => {
      const str = (k: string) => String(fd.get(k) ?? "").trim();
      const res = await createCustomOrderAction({
        designId,
        shopId,
        quantity: Number(str("quantity")),
        requirements: str("requirements"),
        budget: str("budget") ? Number(str("budget")) : undefined,
        deadline: str("deadline") ? new Date(`${str("deadline")}T12:00:00`).toISOString() : undefined,
      });
      setErrors(res.fieldErrors ?? {});
      if (!res.ok) {
        setFormError(res.message);
        return void toast.error(res.message);
      }
      toast.success(res.message);
      router.push(res.id ? `/account/custom-orders/${res.id}` : "/account/custom-orders");
    });

  const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
  return (
    <form action={submit} className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="grid content-start gap-3">
        <div className="kite-pattern grid place-items-center rounded-md border border-border bg-surface-2 p-4">
          <KitePreview design={design.design} className="h-60 w-full" title={design.name} />
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Design
          <select value={designId} onChange={(e) => setDesignId(e.target.value)} className="h-11 rounded-md border border-border bg-surface px-3">
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </aside>

      <div className="grid content-start gap-6">
        {formError && <Alert tone="error">{formError}</Alert>}
        <fieldset className={card}>
          <legend className="sr-only">Shop</legend>
          <h2 className="font-display font-semibold">Choose a shop</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {shops.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="shop" required value={s.id} checked={shopId === s.id} onChange={() => setShopId(s.id)} className="mt-1 accent-[var(--primary)]" />
                  <span className="grid gap-0.5">
                    <span className="flex items-center gap-1 font-medium">{s.name}{s.isVerified && <BadgeCheck className="size-4 text-primary" aria-label="Verified" />}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {s.city}
                      {s.ratingCount > 0 && <> · <Star className="size-3" aria-hidden="true" />{s.ratingAvg.toFixed(1)} ({s.ratingCount})</>}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {errors.shopId && <p className="text-sm text-danger">{errors.shopId}</p>}
        </fieldset>

        <section className={card}>
          <h2 className="font-display font-semibold">What you need</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantity" name="quantity" type="number" min={1} max={1000} required defaultValue={1} error={errors.quantity} />
            <Field label="Budget for all (Rs, optional)" name="budget" type="number" min={1} error={errors.budget} />
            <Field label="Needed by (optional)" name="deadline" type="date" min={tomorrow} error={errors.deadline} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="requirements" className="text-sm font-medium">Details for the shop</label>
            <textarea id="requirements" name="requirements" required minLength={10} maxLength={2000} rows={5} placeholder="Material, exact size, occasion, anything the shop should know." className="rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {errors.requirements && <p className="text-sm text-danger">{errors.requirements}</p>}
          </div>
          <p className="text-xs text-muted">Shops make kites with paper and plain cotton string only. Requests for unsafe string or materials are refused.</p>
        </section>

        <div><Button type="submit" size="lg" loading={pending} disabled={!shopId}>Send request</Button></div>
      </div>
    </form>
  );
}
