"use client";

import { FileText, ImagePlus, Star, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/button";

export interface Uploaded {
  id: string;
  url: string | null;
  originalName: string;
}

type Purpose = "product_image" | "shop_logo" | "shop_banner" | "seller_document" | "tournament_banner" | "match_evidence" | "post_media" | "event_banner" | "design_asset" | "payment_proof";

const ACCEPT: Record<Purpose, string> = {
  product_image: "image/jpeg,image/png,image/webp",
  shop_logo: "image/jpeg,image/png,image/webp",
  shop_banner: "image/jpeg,image/png,image/webp",
  seller_document: "image/jpeg,image/png,application/pdf",
  tournament_banner: "image/jpeg,image/png,image/webp",
  match_evidence: "image/jpeg,image/png,image/webp,application/pdf",
  post_media: "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm",
  event_banner: "image/jpeg,image/png,image/webp",
  design_asset: "image/jpeg,image/png,image/webp",
  payment_proof: "image/jpeg,image/png,image/webp,application/pdf",
};

export async function uploadFile(file: File, purpose: Purpose): Promise<Uploaded> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/uploads?purpose=${purpose}`, { method: "POST", body: form });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed. Please try again.");
  return json.data;
}

/** Product photos: upload several, remove, and pick the cover (first photo). */
export function ImageListUpload({
  value,
  onChange,
  max = 8,
}: {
  value: { uploadId: string; url: string }[];
  onChange: (next: { uploadId: string; url: string }[]) => void;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  const add = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, max - value.length);
    if (!list.length) return;
    setBusy(list.length);
    const added: { uploadId: string; url: string }[] = [];
    for (const file of list) {
      try {
        const u = await uploadFile(file, "product_image");
        added.push({ uploadId: u.id, url: u.url! });
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
      setBusy((n) => n - 1);
    }
    onChange([...value, ...added]);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="grid gap-2">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <li key={img.uploadId} className="group relative aspect-square overflow-hidden rounded-md border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-ink">Cover</span>
            ) : (
              <button
                type="button"
                onClick={() => onChange([img, ...value.filter((_, j) => j !== i)])}
                className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-surface/90 px-1.5 py-0.5 text-[11px] font-semibold"
              >
                <Star className="size-3" aria-hidden="true" /> Make cover
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 rounded-full bg-surface/90 p-1 hover:bg-surface"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {value.length < max && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy > 0}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary"
            >
              {busy > 0 ? <Spinner className="size-5" /> : <ImagePlus className="size-6" aria-hidden="true" />}
              {busy > 0 ? `Uploading ${busy}…` : "Add photos"}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept={ACCEPT.product_image} multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="text-xs text-muted">JPG, PNG or WebP, up to 5 MB each. The first photo is the cover. Up to {max} photos.</p>
    </div>
  );
}

/** One file (logo, banner or document) with a preview or file name. */
export function SingleUpload({
  label,
  purpose,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  purpose: Purpose;
  value: Uploaded | null;
  onChange: (u: Uploaded | null) => void;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const isImage = purpose !== "seller_document" && purpose !== "match_evidence" && purpose !== "payment_proof";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadFile(file, purpose));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="grid gap-1.5">
      <span id={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
        {value && isImage && value.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt="" className={`${purpose === "shop_banner" || purpose === "tournament_banner" ? "h-12 w-24" : "size-12"} shrink-0 rounded object-cover`} />
        ) : (
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded bg-surface-2 text-muted">
            {value ? <FileText className="size-5" /> : <Upload className="size-5" />}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{value ? value.originalName : <span className="text-muted">No file chosen</span>}</span>
        <button
          type="button"
          aria-describedby={id}
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
        >
          {busy && <Spinner />}
          {value ? "Replace" : "Choose file"}
        </button>
        {value && !required && (
          <button type="button" onClick={() => onChange(null)} className="text-sm font-medium text-danger hover:underline">
            Remove
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <input ref={input} type="file" accept={ACCEPT[purpose]} hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
