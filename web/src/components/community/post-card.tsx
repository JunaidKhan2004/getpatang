"use client";

import { Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePostAction, editPostAction, likeAction, shareAction } from "@/app/actions/community";
import { Button } from "@/components/ui/button";
import { type PostView, timeAgo } from "@/lib/community";

import { ReportButton } from "./report-button";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "size-8 text-sm", md: "size-10 text-base", lg: "size-20 text-3xl" }[size];
  return <span aria-hidden="true" className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-display font-semibold text-primary-ink`}>{name.charAt(0).toUpperCase()}</span>;
}

export function PostMedia({ media }: { media: PostView["media"] }) {
  if (!media.length) return null;
  if (media[0].kind === "video") {
    return (
      <video controls preload="metadata" className="max-h-[520px] w-full rounded-md bg-black" aria-label="Video attached to the post">
        <source src={media[0].url} type={media[0].mimeType} />
        Your browser cannot play this video.
      </video>
    );
  }
  return (
    <div className={`grid gap-1 overflow-hidden rounded-md ${media.length > 1 ? "grid-cols-2" : ""}`}>
      {media.map((m, i) => (
        // Photos come from object storage; next/image remote patterns are configured with production storage.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.url} src={m.url} alt={`Photo ${i + 1}`} loading="lazy" className={`w-full object-cover ${media.length > 1 ? "aspect-square" : "max-h-[520px]"}`} />
      ))}
    </div>
  );
}

export function PostCard({ post: initial, linkToPost = true }: { post: PostView; linkToPost?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [post, setPost] = useState(initial);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.body);
  const [deleted, setDeleted] = useState(false);
  const [pending, start] = useTransition();

  const needSignIn = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);

  const toggleLike = () =>
    start(async () => {
      const next = !post.likedByMe;
      setPost((p) => ({ ...p, likedByMe: next, likeCount: p.likeCount + (next ? 1 : -1) }));
      const res = await likeAction(post.id, next);
      if (res.signIn) return needSignIn();
      if (res.ok && res.data) setPost((p) => ({ ...p, likedByMe: res.data!.liked, likeCount: res.data!.likeCount }));
      else {
        setPost((p) => ({ ...p, likedByMe: !next, likeCount: p.likeCount + (next ? -1 : 1) }));
        toast.error(res.message);
      }
    });

  const share = () =>
    start(async () => {
      const res = await shareAction(post.id);
      if (!res.ok || !res.data) return void toast.error(res.message);
      const url = `${window.location.origin}${res.data.path}`;
      setPost((p) => ({ ...p, shareCount: res.data!.shareCount }));
      try {
        if (navigator.share) await navigator.share({ title: `Post by ${post.author.name}`, url });
        else {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied.");
        }
      } catch {
        // The share sheet was closed; nothing to do.
      }
    });

  if (deleted) return null;
  const date = (
    <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString("en-PK")}>
      {timeAgo(post.createdAt)}{post.editedAt && " · edited"}
    </time>
  );

  return (
    <article className="grid gap-3 rounded-md border border-border bg-surface p-4" aria-labelledby={`p-${post.id}`}>
      <header className="flex items-start gap-3">
        <Link href={`/community/u/${post.author.id}`}><Avatar name={post.author.name} /></Link>
        <div className="min-w-0 flex-1">
          <Link id={`p-${post.id}`} href={`/community/u/${post.author.id}`} className="font-semibold hover:text-primary">{post.author.name}</Link>
          <p className="text-xs text-muted">
            {post.author.city && `${post.author.city} · `}
            {linkToPost ? <Link href={`/community/posts/${post.id}`} className="hover:underline">{date}</Link> : date}
          </p>
        </div>
        <div className="relative">
          <button type="button" aria-label="Post options" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="rounded-md p-1.5 text-muted hover:bg-surface-2">
            <MoreHorizontal className="size-5" />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg">
              {post.isMine ? (
                <>
                  <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setEditing(true); setMenu(false); }}>Edit post</button>
                  <button
                    type="button"
                    className="block w-full rounded px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
                    onClick={() =>
                      start(async () => {
                        const res = await deletePostAction(post.id);
                        if (res.ok) {
                          toast.success(res.message);
                          setDeleted(true);
                          if (!linkToPost) router.push("/community");
                        } else toast.error(res.message);
                      })
                    }
                  >
                    Delete post
                  </button>
                </>
              ) : (
                <ReportButton targetType="post" targetId={post.id} label="Report post" />
              )}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await editPostAction(post.id, draft.trim());
              if (res.ok) {
                setPost((p) => ({ ...p, body: draft.trim(), editedAt: new Date().toISOString() }));
                setEditing(false);
                toast.success(res.message);
              } else toast.error(res.message);
            });
          }}
        >
          <label htmlFor={`edit-${post.id}`} className="sr-only">Edit post</label>
          <textarea id={`edit-${post.id}`} value={draft} maxLength={2000} rows={4} onChange={(e) => setDraft(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2" />
          <div className="flex gap-2"><Button type="submit" size="sm" loading={pending} disabled={!draft.trim()}>Save</Button><Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>
      ) : (
        <p className="whitespace-pre-line break-words">{post.body}</p>
      )}

      <PostMedia media={post.media} />

      <footer className="flex items-center gap-1 border-t border-border pt-2 text-sm">
        <button type="button" onClick={toggleLike} aria-pressed={post.likedByMe} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-surface-2 aria-pressed:text-primary">
          <Heart className={`size-4 ${post.likedByMe ? "fill-current" : ""}`} aria-hidden="true" /> {post.likeCount}<span className="sr-only"> likes</span>
        </button>
        <Link href={`/community/posts/${post.id}#comments`} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-surface-2">
          <MessageCircle className="size-4" aria-hidden="true" /> {post.commentCount}<span className="sr-only"> comments</span>
        </Link>
        <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-surface-2">
          <Share2 className="size-4" aria-hidden="true" /> {post.shareCount > 0 ? post.shareCount : "Share"}<span className="sr-only"> shares</span>
        </button>
      </footer>
    </article>
  );
}
