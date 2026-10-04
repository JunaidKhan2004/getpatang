"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProductAction, productVisibilityAction, updateStockAction } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import type { SellerProduct } from "@/lib/seller";
import { useT } from "@/lib/i18n/client";

/** Per-row menu: edit, quick stock, pause/show, delete (with an inline confirmation). */
export function ProductRowActions({ product: p }: { product: SellerProduct }) {
  const t = useT();
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

  const item = "block w-full rounded px-3 py-2 text-start text-sm hover:bg-surface-2";
  return (
    <div className="relative inline-block text-start">
      <button type="button" aria-label={t("Actions for {title}", { title: p.title })} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-md p-2 hover:bg-surface-2">
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute end-0 z-20 mt-1 w-64 rounded-md border border-border bg-surface p-1 shadow-lg">
          {mode === "menu" && (
            <>
              <Link href={`/seller/products/${p.id}`} className={item}>{t("Edit")}</Link>
              <button type="button" className={item} onClick={() => setMode("stock")}>{t("Update stock")}</button>
              {p.status === "ACTIVE" && <button type="button" className={item} disabled={pending} onClick={() => act(() => productVisibilityAction(p.id, false))}>{t("Pause (hide from shop)")}</button>}
              {p.status === "HIDDEN" && <button type="button" className={item} disabled={pending} onClick={() => act(() => productVisibilityAction(p.id, true))}>{t("Show in shop again")}</button>}
              {p.status === "ACTIVE" && <a href={`/products/${p.slug}`} target="_blank" className={item}>{t("View in shop")}</a>}
              <button type="button" className={`${item} text-danger`} onClick={() => setMode("delete")}>{t("Delete")}</button>
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
                <label className="grid gap-1 text-sm">{t("Units in stock")}<input type="number" min={0} value={simpleStock} onChange={(e) => setSimpleStock(Number(e.target.value))} className="h-9 rounded border border-border bg-surface px-2" />
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
                <Button type="submit" size="sm" loading={pending}>{t("Save")}</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode("menu")}>{t("Back")}</Button>
              </div>
            </form>
          )}
          {mode === "delete" && (
            <div className="grid gap-2 p-2 text-sm">
              <p>{t("Delete")}{" "}<strong>{p.title}</strong>{t("? Products with past orders are kept in your records but removed from the shop.")}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={pending} onClick={() => act(() => deleteProductAction(p.id))}>{t("Delete")}</Button>
                <Button size="sm" variant="secondary" onClick={() => setMode("menu")}>{t("Keep")}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
