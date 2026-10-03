"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveProductAction } from "@/app/actions/seller";
import { ImageListUpload } from "@/components/seller/uploads";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE, type SellerProduct } from "@/lib/seller";

interface VariantRow {
  key: string;
  id?: string;
  name: string;
  sku: string;
  price: string;
  stock: string;
}

let keySeq = 0;
const newKey = () => `v${++keySeq}`;

const card = "grid gap-4 rounded-md border border-border bg-surface p-5";
const input = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function ProductForm({
  product: p,
  categories,
  requiresApproval,
}: {
  product: SellerProduct | null;
  categories: { id: string; label: string }[];
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [images, setImages] = useState(
    (p?.images ?? []).filter((i) => i.uploadId).map((i) => ({ uploadId: i.uploadId!, url: i.url })),
  );
  const [specs, setSpecs] = useState(p?.specifications.length ? p.specifications : [{ label: "", value: "" }]);
  const [variants, setVariants] = useState<VariantRow[]>(
    (p?.variants ?? []).map((v) => ({ key: newKey(), id: v.id, name: v.name, sku: v.sku ?? "", price: v.price?.toString() ?? "", stock: String(v.stock) })),
  );

  const submit = (fd: FormData, publish: boolean) => {
    setFormError(undefined);
    const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : undefined);
    const body = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      categoryId: String(fd.get("categoryId") ?? ""),
      price: num("price"),
      compareAtPrice: num("compareAtPrice") ?? null,
      stock: variants.length ? undefined : (num("stock") ?? 0),
      sku: String(fd.get("sku") ?? "") || undefined,
      lowStockAt: num("lowStockAt"),
      shippingInfo: String(fd.get("shippingInfo") ?? "") || undefined,
      videoUrl: String(fd.get("videoUrl") ?? "") || null,
      imageUploadIds: images.map((i) => i.uploadId),
      specifications: specs.filter((s) => s.label.trim() && s.value.trim()),
      variants: variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku || undefined, price: v.price ? Number(v.price) : undefined, stock: Number(v.stock || 0) })),
      publish,
    };
    start(async () => {
      const res = await saveProductAction(p?.id ?? null, body);
      setErrors(res.fieldErrors ?? {});
      if (!res.ok) {
        setFormError(res.message);
        toast.error(res.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast.success(publish ? (requiresApproval ? "Saved and sent for approval." : "Product is live.") : "Draft saved.");
      router.push("/seller/products");
      router.refresh();
    });
  };

  return (
    <form
      className="grid gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        submit(new FormData(e.currentTarget), submitter?.value !== "draft");
      }}
    >
      {p && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={PRODUCT_STATUS_TONE[p.status]}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
          {p.status === "REJECTED" && p.reviewNote && <span className="text-sm text-danger">Reason: {p.reviewNote}</span>}
        </div>
      )}
      {formError && <Alert tone="error">{formError}</Alert>}
      {requiresApproval && (
        <Alert>New products, and changes to a live product’s title, description, photos or category, are checked by our team before they appear. Price and stock changes go live straight away.</Alert>
      )}

      <section className={card} aria-labelledby="basics">
        <h2 id="basics" className="font-display font-semibold">Basics</h2>
        <Field label="Title" name="title" required minLength={3} maxLength={120} defaultValue={p?.title} error={errors.title} />
        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <textarea id="description" name="description" required minLength={20} maxLength={5000} rows={6} defaultValue={p?.description} className="rounded-md border border-border bg-surface px-4 py-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium">Category</label>
          <select id="categoryId" name="categoryId" required defaultValue={p?.category.id ?? ""} className={`${input} h-12`}>
            <option value="" disabled>Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {errors.categoryId && <p className="text-sm text-danger">{errors.categoryId}</p>}
        </div>
      </section>

      <section className={card} aria-labelledby="photos">
        <h2 id="photos" className="font-display font-semibold">Photos</h2>
        <ImageListUpload value={images} onChange={setImages} />
        {errors.imageUploadIds && <p className="text-sm text-danger">{errors.imageUploadIds}</p>}
        <Field label="Video link (optional)" name="videoUrl" type="url" placeholder="https://youtube.com/…" defaultValue={p?.videoUrl ?? ""} error={errors.videoUrl} />
      </section>

      <section className={`${card} sm:grid-cols-2`} aria-labelledby="pricing">
        <h2 id="pricing" className="font-display font-semibold sm:col-span-2">Price and stock</h2>
        <Field label="Price (Rs)" name="price" type="number" min={1} required inputMode="numeric" defaultValue={p?.price} error={errors.price} />
        <Field label="Original price (optional)" name="compareAtPrice" type="number" min={1} inputMode="numeric" hint="Shown crossed out to mark a discount." defaultValue={p?.compareAtPrice ?? ""} error={errors.compareAtPrice} />
        {variants.length === 0 && <Field label="Units in stock" name="stock" type="number" min={0} required inputMode="numeric" defaultValue={p?.stock ?? 0} error={errors.stock} />}
        <Field label="SKU (optional)" name="sku" maxLength={40} defaultValue={p?.sku ?? ""} error={errors.sku} />
        <Field label="Warn me when stock is at or below" name="lowStockAt" type="number" min={0} defaultValue={p?.lowStockAt ?? 5} error={errors.lowStockAt} />
      </section>

      <section className={card} aria-labelledby="options">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="options" className="font-display font-semibold">Options (size, colour…)</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => setVariants([...variants, { key: newKey(), name: "", sku: "", price: "", stock: "0" }])}>
            <Plus className="size-4" aria-hidden="true" /> Add option
          </Button>
        </div>
        {variants.length === 0 ? (
          <p className="text-sm text-muted">No options. Add options if this product comes in different sizes or colours; each option has its own stock.</p>
        ) : (
          <div className="grid gap-2">
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold text-muted uppercase sm:grid">
              <span>Option name</span><span>Price (blank = same)</span><span>Stock</span><span>SKU</span><span />
            </div>
            {variants.map((v, i) => (
              <div key={v.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <input aria-label={`Option ${i + 1} name`} required maxLength={60} placeholder="e.g. Large · Red" value={v.name} onChange={(e) => setVariants(variants.map((x) => (x.key === v.key ? { ...x, name: e.target.value } : x)))} className={`${input} col-span-2 sm:col-span-1`} />
                <input aria-label={`Option ${i + 1} price`} type="number" min={1} placeholder="Price" value={v.price} onChange={(e) => setVariants(variants.map((x) => (x.key === v.key ? { ...x, price: e.target.value } : x)))} className={input} />
                <input aria-label={`Option ${i + 1} stock`} type="number" min={0} required value={v.stock} onChange={(e) => setVariants(variants.map((x) => (x.key === v.key ? { ...x, stock: e.target.value } : x)))} className={input} />
                <input aria-label={`Option ${i + 1} SKU`} maxLength={40} placeholder="SKU" value={v.sku} onChange={(e) => setVariants(variants.map((x) => (x.key === v.key ? { ...x, sku: e.target.value } : x)))} className={input} />
                <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setVariants(variants.filter((x) => x.key !== v.key))} className="inline-flex h-10 items-center justify-center rounded-md px-2 text-danger hover:bg-surface-2">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {errors.variants && <p className="text-sm text-danger">{errors.variants}</p>}
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="details">
        <h2 id="details" className="font-display font-semibold">Specifications</h2>
        {specs.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <input aria-label={`Specification ${i + 1} name`} placeholder="e.g. Material" maxLength={40} value={s.label} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={input} />
            <input aria-label={`Specification ${i + 1} value`} placeholder="e.g. Tissue paper, bamboo" maxLength={120} value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className={input} />
            <button type="button" aria-label={`Remove specification ${i + 1}`} onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="rounded-md px-2 text-danger hover:bg-surface-2"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <div><Button type="button" size="sm" variant="secondary" onClick={() => setSpecs([...specs, { label: "", value: "" }])}><Plus className="size-4" aria-hidden="true" /> Add specification</Button></div>
        <Field label="Shipping information (optional)" name="shippingInfo" maxLength={300} placeholder="e.g. Ships within 2 working days" defaultValue={p?.shippingInfo ?? ""} error={errors.shippingInfo} />
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="submit" value="publish" loading={pending} size="lg">{requiresApproval ? "Save and send for approval" : "Publish"}</Button>
        <Button type="submit" value="draft" variant="secondary" size="lg" disabled={pending} formNoValidate>
          {p?.status === "ACTIVE" ? "Save and pause" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}
