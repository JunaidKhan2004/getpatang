"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { commentAction, deleteCommentAction } from "@/app/actions/community";
import { Avatar } from "@/components/community/post-card";
import { ReportButton } from "@/components/community/report-button";
import { Button } from "@/components/ui/button";
import { type CommentView } from "@/lib/community";
import { useT, useFormat } from "@/lib/i18n/client";

function CommentForm({ postId, parentId, onDone, autoFocus = false }: { postId: string; parentId?: string; onDone?: () => void; autoFocus?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await commentAction(postId, body.trim(), parentId);
          if (res.ok) {
            setBody("");
            onDone?.();
            router.refresh();
          } else toast.error(res.message);
        });
      }}
    >
      <label htmlFor={`c-${parentId ?? "top"}`} className="sr-only">{parentId ? t("Write a reply") : t("Write a comment")}</label>
      <input
        id={`c-${parentId ?? "top"}`}
        value={body}
        autoFocus={autoFocus}
        maxLength={1000}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? t("Write a reply…") : t("Write a comment…")}
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <Button type="submit" size="sm" className="h-10" loading={pending} disabled={!body.trim()}>{parentId ? t("Reply") : t("Comment")}</Button>
    </form>
  );
}

function CommentItem({ c, postId, canReply, postIsMine, signedIn }: { c: CommentView; postId: string; canReply: boolean; postIsMine: boolean; signedIn: boolean }) {
  const { timeAgo } = useFormat();
  const t = useT();
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();
  return (
    <li className="grid gap-2">
      <div className="flex gap-3">
        <Link href={`/community/u/${c.author.id}`}><Avatar name={c.author.name} size="sm" /></Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-md bg-surface-2 px-3 py-2">
            <Link href={`/community/u/${c.author.id}`} className="text-sm font-semibold hover:text-primary">{c.author.name}</Link>
            <p className="text-sm whitespace-pre-line break-words">{c.body}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
            <time dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
            {canReply && signedIn && <button type="button" onClick={() => setReplying((r) => !r)} className="font-semibold hover:text-primary">{t("Reply")}</button>}
            {(c.isMine || postIsMine) && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await deleteCommentAction(postId, c.id);
                  if (res.ok) router.refresh();
                  else toast.error(res.message);
                })}
                className="font-semibold hover:text-danger"
              >
                {t("Delete")}</button>
            )}
            {!c.isMine && signedIn && <ReportButton targetType="comment" targetId={c.id} compact />}
          </div>
          {replying && <div className="mt-2"><CommentForm postId={postId} parentId={c.id} autoFocus onDone={() => setReplying(false)} /></div>}
          {c.replies && c.replies.length > 0 && (
            <ul className="mt-3 grid gap-3">
              {c.replies.map((r) => <CommentItem key={r.id} c={r} postId={postId} canReply={false} postIsMine={postIsMine} signedIn={signedIn} />)}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

export function Comments({ postId, initial, signedIn, postIsMine }: { postId: string; initial: CommentView[]; signedIn: boolean; postIsMine: boolean }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <div className="grid gap-4">
      {signedIn ? (
        <CommentForm postId={postId} />
      ) : (
        <p className="text-sm text-muted"><Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-semibold text-primary hover:underline">{t("Sign in")}</Link> {" "}{t("to join the conversation.")}</p>
      )}
      {initial.length === 0 ? (
        <p className="text-sm text-muted">{t("No comments yet.")}</p>
      ) : (
        <ul className="grid gap-4">{initial.map((c) => <CommentItem key={c.id} c={c} postId={postId} canReply postIsMine={postIsMine} signedIn={signedIn} />)}</ul>
      )}
    </div>
  );
}
