"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProductAction, productVisibilityAction, updateStockAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import type { SellerProduct } from "@/lib/seller";

/** Per-row menu: edit, quick stock, pause/show, delete (with an inline confirmation). */
export function ProductRowActions({ product: p }: { product: SellerProduct }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "stock" | "delete">("menu");
  const [pending, start] = useTransition();
  const [stock, setStock] = useState<Record<string, number>>(Object.fromEntries(p.variants.map((v) => [v.id, v.stock])));
  const [simpleStock, setSimpleStock] = useState(p.stock);

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setMode("menu");
      } else toast.error(res.message);
    });

  const item = "block w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-2";
  return (
    <div className="relative inline-block text-left">
      <button type="button" aria-label={`Actions for ${p.title}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-md p-2 hover:bg-surface-2">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-border bg-surface p-1 shadow-lg">
          {mode === "menu" && (
            <>
              <Link href={`/seller/products/${p.id}`} className={item}>Edit</Link>
              <button type="button" className={item} onClick={() => setMode("stock")}>Update stock</button>
              {p.status === "ACTIVE" && <button type="button" className={item} disabled={pending} onClick={() => act(() => productVisibilityAction(p.id, false))}>Pause (hide from shop)</button>}
              {p.status === "HIDDEN" && <button type="button" className={item} disabled={pending} onClick={() => act(() => productVisibilityAction(p.id, true))}>Show in shop again</button>}
              {p.status === "ACTIVE" && <a href={`/products/${p.slug}`} target="_blank" className={item}>View in shop</a>}
              <button type="button" className={`${item} text-danger`} onClick={() => setMode("delete")}>Delete</button>
            </>
          )}
          {mode === "stock" && (
            <form
              className="grid gap-2 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                act(() => updateStockAction(p.id, p.variants.length ? { variants: stock } : { stock: simpleStock }));
              }}
            >
              {p.variants.length === 0 ? (
                <label className="grid gap-1 text-sm">Units in stock
                  <input type="number" min={0} value={simpleStock} onChange={(e) => setSimpleStock(Number(e.target.value))} className="h-9 rounded border border-border bg-surface px-2" />
                </label>
              ) : (
                p.variants.map((v) => (
                  <label key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{v.name}</span>
                    <input type="number" min={0} value={stock[v.id]} onChange={(e) => setStock({ ...stock, [v.id]: Number(e.target.value) })} className="h-8 w-20 rounded border border-border bg-surface px-2" />
                  </label>
                ))
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={pending}>Save</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode("menu")}>Back</Button>
              </div>
            </form>
          )}
          {mode === "delete" && (
            <div className="grid gap-2 p-2 text-sm">
              <p>Delete <strong>{p.title}</strong>? Products with past orders are kept in your records but removed from the shop.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={pending} onClick={() => act(() => deleteProductAction(p.id))}>Delete</Button>
                <Button size="sm" variant="secondary" onClick={() => setMode("menu")}>Keep</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
