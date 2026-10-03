import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Avatar, PostCard } from "@/components/community/post-card";
import { Pagination } from "@/components/market/pagination";
import { EmptyState } from "@/components/ui/feedback";
import { api, ApiError, apiPage } from "@/lib/api";
import type { CommunityProfile, PostView } from "@/lib/community";
import { formatDate } from "@/lib/market";
import { getAccessToken } from "@/lib/session";

import { ProfileActions } from "./profile-actions";

const getProfile = cache(async (id: string) => {
  try {
    return await api<CommunityProfile>(`/community/users/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: (await getProfile((await params).id)).name };
}

export default async function CommunityProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const { page } = await searchParams;
  const p = await getProfile(id);
  const posts = p.isBlocked ? null : await apiPage<PostView>(`/community/users/${id}/posts`, { token: await getAccessToken(), query: { page, pageSize: 20 } }).catch(() => null);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <header className="grid gap-4 rounded-md border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={p.name} size="lg" />
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
              {p.city && <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{p.city}</span>}
              <span>Joined {formatDate(p.memberSince)}</span>
            </p>
          </div>
          {!p.isMe && <ProfileActions userId={p.id} isFollowing={p.isFollowing} isBlocked={p.isBlocked} />}
        </div>
        {p.bio && <p>{p.bio}</p>}
        {!p.isBlocked && (
          <dl className="flex gap-6 text-sm">
            <div><dt className="text-muted">Posts</dt><dd className="font-display text-lg font-bold tabular-nums">{p.posts}</dd></div>
            <div><dt className="text-muted">Followers</dt><dd className="font-display text-lg font-bold tabular-nums">{p.followers}</dd></div>
            <div><dt className="text-muted">Following</dt><dd className="font-display text-lg font-bold tabular-nums">{p.following}</dd></div>
          </dl>
        )}
        <Link href={`/players/${p.id}`} className="text-sm font-semibold text-primary hover:underline">Tournament record and rankings</Link>
      </header>

      {p.isBlocked ? (
        <EmptyState title="You blocked this person" message="Unblock them to see their posts again." />
      ) : posts && posts.data.length > 0 ? (
        <>
          <div className="grid gap-4">{posts.data.map((post) => <PostCard key={post.id} post={post} />)}</div>
          <Pagination meta={posts.meta} basePath={`/community/u/${id}`} params={{}} />
        </>
      ) : (
        <EmptyState title="No posts yet" message={p.isMe ? "Share your first post from the community feed." : "This person has not posted yet."} />
      )}
    </div>
  );
}
