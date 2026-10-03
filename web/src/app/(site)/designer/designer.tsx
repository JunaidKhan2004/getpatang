"use client";

import { ImagePlus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveDesignAction } from "@/app/actions/custom-orders";
import { KitePreview } from "@/components/designer/kite-preview";
import { uploadFile } from "@/components/seller/uploads";
import { Button, Spinner } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
  DEFAULT_DESIGN,
  FONT_LABEL,
  KITE_FONTS,
  KITE_PATTERNS,
  KITE_SHAPES,
  KITE_SIZES,
  type KiteDesign,
  PATTERN_LABEL,
  SHAPE_LABEL,
  SIZE_LABEL,
  SWATCHES,
} from "@/lib/designer";

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value.toLowerCase() === c.toLowerCase()}
            onClick={() => onChange(c)}
            className="size-8 rounded-full border border-border ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-primary"
            style={{ background: c }}
          />
        ))}
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded border border-border bg-surface" />
          Custom
        </label>
      </div>
    </fieldset>
  );
}

function Choice<T extends string>({ label, options, value, onChange, labels }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; labels: Record<T, string> }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Designer({ initial }: { initial: { id: string; name: string; design: KiteDesign } | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [design, setDesign] = useState<KiteDesign>(initial?.design ?? DEFAULT_DESIGN);
  const [name, setName] = useState(initial?.name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof KiteDesign>(k: K, v: KiteDesign[K]) => setDesign((d) => ({ ...d, [k]: v }));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadFile(file, "design_asset");
      setDesign((d) => ({ ...d, imageUploadId: u.id, imageUrl: u.url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = (thenRequest: boolean) =>
    start(async () => {
      const res = await saveDesignAction(initial?.id ?? null, name.trim(), design);
      if (res.signIn) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
      const fe = res.fieldErrors ?? {};
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace(/^design\./, ""), v])));
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      const id = initial?.id ?? res.id;
      if (thenRequest && id) router.push(`/account/custom-orders/new?design=${id}`);
      else if (!initial?.id && id) router.replace(`/designer?id=${id}`);
      else router.refresh();
    });

  const card = "grid gap-5 rounded-md border border-border bg-surface p-5";
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="kite-pattern grid place-items-center rounded-md border border-border bg-surface-2 p-6">
          <KitePreview design={design} className="h-[380px] w-full max-w-[300px]" title={`Preview of ${name || "your kite"}`} />
        </div>
        <p className="mt-2 text-center text-xs text-muted">Preview only. The shop confirms materials, exact colours and size in its quote.</p>
      </div>

      <div className="grid content-start gap-6">
        <section className={card} aria-labelledby="d-shape">
          <h2 id="d-shape" className="font-display font-semibold">Shape and size</h2>
          <Choice label="Shape" options={KITE_SHAPES} value={design.shape} onChange={(v) => set("shape", v)} labels={SHAPE_LABEL} />
          <Choice label="Size" options={KITE_SIZES} value={design.size} onChange={(v) => set("size", v)} labels={SIZE_LABEL} />
        </section>

        <section className={card} aria-labelledby="d-colour">
          <h2 id="d-colour" className="font-display font-semibold">Colours and pattern</h2>
          <ColorPicker label="Kite colour" value={design.background} onChange={(c) => set("background", c)} />
          <Choice label="Pattern" options={KITE_PATTERNS} value={design.pattern} onChange={(v) => set("pattern", v)} labels={PATTERN_LABEL} />
          {design.pattern !== "none" && <ColorPicker label="Pattern colour" value={design.patternColor} onChange={(c) => set("patternColor", c)} />}
        </section>

        <section className={card} aria-labelledby="d-text">
          <h2 id="d-text" className="font-display font-semibold">Text and logo</h2>
          <Field label="Text on the kite (optional)" maxLength={24} value={design.text ?? ""} onChange={(e) => set("text", e.target.value)} error={errors.text} hint={`${(design.text ?? "").length}/24 characters`} />
          {design.text && (
            <>
              <Choice label="Lettering" options={KITE_FONTS} value={design.font} onChange={(v) => set("font", v)} labels={FONT_LABEL} />
              <ColorPicker label="Text colour" value={design.textColor} onChange={(c) => set("textColor", c)} />
            </>
          )}
          <div className="grid gap-2">
            <span className="text-sm font-medium">Logo or photo (optional)</span>
            {design.imageUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={design.imageUrl} alt="" className="size-14 rounded-full border border-border object-cover" />
                <Button type="button" variant="secondary" size="sm" onClick={() => setDesign((d) => ({ ...d, imageUploadId: null, imageUrl: null }))}>
                  <X className="size-4" aria-hidden="true" /> Remove
                </Button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex w-fit items-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary">
                {uploading ? <Spinner /> : <ImagePlus className="size-4" aria-hidden="true" />}
                {uploading ? "Uploading…" : "Add a logo (JPG, PNG or WebP)"}
              </button>
            )}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pickImage(e.target.files?.[0])} />
            {errors.imageUploadId && <p className="text-sm text-danger">{errors.imageUploadId}</p>}
          </div>
        </section>

        <section className={card} aria-labelledby="d-tail">
          <h2 id="d-tail" className="font-display font-semibold">Tail</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={design.tail} onChange={(e) => set("tail", e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Add a tail
          </label>
          {design.tail && <ColorPicker label="Tail colour" value={design.tailColor} onChange={(c) => set("tailColor", c)} />}
        </section>

        <section className={card} aria-labelledby="d-save">
          <h2 id="d-save" className="font-display font-semibold">Save</h2>
          <Field label="Design name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Team Falcon patang" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" loading={pending} disabled={name.trim().length < 2} onClick={() => save(true)}>Save and request a quote</Button>
            <Button type="button" variant="secondary" loading={pending} disabled={name.trim().length < 2} onClick={() => save(false)}>Save design</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
