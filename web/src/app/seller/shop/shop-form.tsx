"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateShopAction } from "@/app/actions/seller";
import { type Uploaded, SingleUpload } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import type { SellerApplication } from "@/lib/seller";
import { PK_PHONE_PATTERN } from "@/lib/validation";

const MAX_FEATURED = 8;

export function ShopForm({ shop, products }: { shop: SellerApplication; products: { id: string; title: string }[] }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const current = (url: string | null, name: string): Uploaded | null => (url ? { id: "", url, originalName: name } : null);
  const [logo, setLogo] = useState<Uploaded | null>(current(shop.logoUrl, "Current logo"));
  const [banner, setBanner] = useState<Uploaded | null>(current(shop.bannerUrl, "Current banner"));
  const [featured, setFeatured] = useState<string[]>(shop.featuredProductIds ?? []);

  /** undefined = unchanged, null = removed, id = new upload. */
  const fileChange = (u: Uploaded | null, originalUrl: string | null) => (u?.id ? u.id : !u && originalUrl ? null : undefined);

  const submit = (fd: FormData) =>
    start(async () => {
      const res = await updateShopAction({
        description: String(fd.get("description") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        address: String(fd.get("address") ?? ""),
        logoUploadId: fileChange(logo, shop.logoUrl),
        bannerUploadId: fileChange(banner, shop.bannerUrl),
        featuredProductIds: featured,
        acceptsCustomOrders: fd.get("acceptsCustomOrders") === "on",
      });
      setErrors(res.fieldErrors ?? {});
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
  return (
    <form action={submit} className="grid gap-6">
      <Alert>Your shop name ({shop.name}), city ({shop.city}) and web address stay fixed after approval. Contact support to change them.</Alert>

      <section className={card} aria-labelledby="brand">
        <h2 id="brand" className="font-display font-semibold">Logo and banner</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SingleUpload label="Logo" purpose="shop_logo" value={logo} onChange={setLogo} hint="Square, up to 2 MB." />
          <SingleUpload label="Banner" purpose="shop_banner" value={banner} onChange={setBanner} hint="Wide image (about 1600 × 400), up to 5 MB." />
        </div>
      </section>

      <section className={card} aria-labelledby="about">
        <h2 id="about" className="font-display font-semibold">About</h2>
        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <textarea id="description" name="description" rows={4} required minLength={20} maxLength={1000} defaultValue={shop.description ?? ""} className="rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
        </div>
      </section>

      <section className={`${card} sm:grid-cols-2`} aria-labelledby="contact">
        <h2 id="contact" className="font-display font-semibold sm:col-span-2">Contact (shown on your shop page)</h2>
        <Field label="Phone" name="phone" type="tel" pattern={PK_PHONE_PATTERN} defaultValue={shop.phone ?? ""} error={errors.phone} />
        <Field label="Email" name="email" type="email" defaultValue={shop.email ?? ""} error={errors.email} />
        <Field label="Address" name="address" className="sm:col-span-2" defaultValue={shop.address ?? ""} error={errors.address} />
      </section>

      <section className={card} aria-labelledby="custom">
        <h2 id="custom" className="font-display font-semibold">Custom kite orders</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptsCustomOrders" defaultChecked={shop.acceptsCustomOrders ?? true} className="mt-0.5 size-4 accent-[var(--primary)]" />
          <span>Accept custom design requests. Customers send a design from the kite designer and you reply with a quote.</span>
        </label>
      </section>

      <section className={card} aria-labelledby="featured">
        <h2 id="featured" className="font-display font-semibold">Featured products</h2>
        <p className="text-sm text-muted">Shown first on your shop page. Choose up to {MAX_FEATURED} live products ({featured.length} chosen).</p>
        {products.length === 0 ? (
          <p className="text-sm text-muted">You have no live products yet.</p>
        ) : (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Featured products</legend>
            {products.map((p) => {
              const checked = featured.includes(p.id);
              return (
                <label key={p.id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && featured.length >= MAX_FEATURED}
                    onChange={() => setFeatured(checked ? featured.filter((x) => x !== p.id) : [...featured, p.id])}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              );
            })}
          </fieldset>
        )}
      </section>

      <div><Button type="submit" size="lg" loading={pending}>Save changes</Button></div>
    </form>
  );
}
