"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveContentPageAction } from "@/app/actions/admin";
import { PageBody } from "@/components/content/page-body";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import type { ContentPageRow } from "@/lib/admin";
import { formatDate } from "@/lib/market";

export function ContentEditor({ pages, initial }: { pages: ContentPageRow[]; initial: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial);
  const page = pages.find((p) => p.slug === slug)!;
  const [drafts, setDrafts] = useState(() => Object.fromEntries(pages.map((p) => [p.slug, { title: p.title, body: p.body }])));
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const draft = drafts[slug];
  const set = (patch: Partial<typeof draft>) => setDrafts((d) => ({ ...d, [slug]: { ...d[slug], ...patch } }));

  const save = (published: boolean) =>
    start(async () => {
      const res = await saveContentPageAction(slug, { title: draft.title.trim(), body: draft.body.trim(), published });
      setErrors(res.fieldErrors ?? {});
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Pages" className="grid content-start gap-1">
        {pages.map((p) => (
          <button
            key={p.slug}
            type="button"
            aria-current={p.slug === slug ? "page" : undefined}
            onClick={() => { setSlug(p.slug); setPreview(false); setErrors({}); }}
            className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-surface-2 aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
          >
            {p.title}
            <Badge tone={p.published ? "success" : "neutral"}>{p.published ? "Live" : "Draft"}</Badge>
          </button>
        ))}
      </nav>

      <section className="grid content-start gap-4 rounded-md border border-border bg-surface p-5" aria-label={`Edit ${page.title}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            Web address: <a href={`/${slug}`} target="_blank" rel="noopener" className="text-primary hover:underline">/{slug}</a>
            {page.updatedAt && ` · last saved ${formatDate(page.updatedAt, true)}`}
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant={preview ? "secondary" : "primary"} onClick={() => setPreview(false)}>Write</Button>
            <Button size="sm" variant={preview ? "primary" : "secondary"} onClick={() => setPreview(true)}>Preview</Button>
          </div>
        </div>
        {preview ? (
          <div className="rounded-md border border-border p-5">
            <h2 className="mb-4 text-2xl font-bold">{draft.title}</h2>
            {draft.body.trim() ? <PageBody body={draft.body} /> : <p className="text-muted">Nothing written yet.</p>}
          </div>
        ) : (
          <>
            <Field label="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} error={errors.title} />
            <div className="grid gap-1.5">
              <label htmlFor="content-body" className="text-sm font-medium">Text</label>
              <textarea id="content-body" rows={18} value={draft.body} onChange={(e) => set({ body: e.target.value })} className="rounded-md border border-border bg-surface px-4 py-3 font-mono text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
              {errors.body ? <p className="text-sm text-danger">{errors.body}</p> : <p className="text-sm text-muted">Leave a blank line between paragraphs. Start a line with &quot;## &quot; for a heading, &quot;- &quot; for a list item.</p>}
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button loading={pending} onClick={() => save(true)}>{page.published ? "Save" : "Publish"}</Button>
          <Button variant="secondary" disabled={pending} onClick={() => save(false)}>{page.published ? "Unpublish" : "Save draft"}</Button>
        </div>
      </section>
    </div>
  );
}
