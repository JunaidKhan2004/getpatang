"use client";

import { ImagePlus, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createPostAction } from "@/app/actions/community";
import { uploadFile } from "@/components/seller/uploads";
import { Button, Spinner } from "@/components/ui/button";

import { Avatar } from "./post-card";

interface Attached {
  id: string;
  url: string;
  kind: "image" | "video";
}

export function Composer({ userName }: { userName: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const hasVideo = media.some((m) => m.kind === "video");

  const attach = async (files: FileList | null, kind: "image" | "video") => {
    const list = Array.from(files ?? []).slice(0, kind === "video" ? 1 : 4 - media.length);
    if (!list.length) return;
    setUploading(true);
    for (const f of list) {
      try {
        const u = await uploadFile(f, "post_media");
        setMedia((m) => [...m, { id: u.id, url: u.url!, kind }]);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    if (imageInput.current) imageInput.current.value = "";
    if (videoInput.current) videoInput.current.value = "";
  };

  return (
    <form
      className="grid gap-3 rounded-md border border-border bg-surface p-4"
      aria-label="Create a post"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createPostAction(body.trim(), media.map((m) => m.id));
          if (res.ok) {
            toast.success(res.message);
            setBody("");
            setMedia([]);
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      <div className="flex gap-3">
        <Avatar name={userName} />
        <label htmlFor="new-post" className="sr-only">What&apos;s happening?</label>
        <textarea
          id="new-post"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Share a flight, a kite you made, or a tip…"
          className="min-w-0 flex-1 resize-y rounded-md border border-border bg-surface px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {media.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {media.map((m) => (
            <li key={m.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="Attached photo" className="h-full w-full object-cover" />
              ) : (
                <video src={m.url} muted className="h-full w-full object-cover" aria-label="Attached video" />
              )}
              <button type="button" aria-label="Remove attachment" onClick={() => setMedia(media.filter((x) => x.id !== m.id))} className="absolute top-1 right-1 rounded-full bg-surface/90 p-1">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={uploading || hasVideo || media.length >= 4} onClick={() => imageInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 disabled:opacity-40">
          <ImagePlus className="size-4" aria-hidden="true" /> Photos
        </button>
        <button type="button" disabled={uploading || media.length > 0} onClick={() => videoInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-2 disabled:opacity-40">
          <Video className="size-4" aria-hidden="true" /> Video
        </button>
        {uploading && <span className="inline-flex items-center gap-2 text-sm text-muted"><Spinner /> Uploading…</span>}
        <span className="ml-auto text-xs text-muted tabular-nums">{body.length}/2000</span>
        <Button type="submit" size="sm" loading={pending} disabled={!body.trim() || uploading}>Post</Button>
      </div>
      <p className="text-xs text-muted">Up to 4 photos (8 MB each) or one video (50 MB). Posts promoting banned strings or unsafe flying are removed.</p>
      <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => attach(e.target.files, "image")} />
      <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => attach(e.target.files, "video")} />
    </form>
  );
}
