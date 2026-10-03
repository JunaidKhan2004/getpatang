import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PostCard } from "@/components/community/post-card";
import { api, ApiError, apiPage } from "@/lib/api";
import type { CommentView, PostView } from "@/lib/community";
import { getAccessToken, getCurrentUser } from "@/lib/session";

import { Comments } from "./comments";

const getPost = cache(async (id: string) => {
  try {
    return await api<PostView>(`/posts/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getPost((await params).id);
  return { title: `${p.author.name} on Kite Platform`, description: p.body.slice(0, 160) };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, user] = await Promise.all([getPost(id), getCurrentUser()]);
  const comments = await apiPage<CommentView>(`/posts/${id}/comments`, { token: await getAccessToken(), query: { pageSize: 100 } }).catch(() => null);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/community" className="hover:text-primary">Community</Link> / Post</nav>
      <PostCard post={post} linkToPost={false} />
      <section id="comments" aria-labelledby="comments-h" className="grid gap-4 scroll-mt-24">
        <h2 id="comments-h" className="text-lg font-semibold">Comments ({post.commentCount})</h2>
        <Comments postId={id} initial={comments?.data ?? []} signedIn={Boolean(user)} postIsMine={post.isMine} />
      </section>
    </div>
  );
}
