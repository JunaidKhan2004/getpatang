import type { Metadata } from "next";
import Link from "next/link";

import { Composer } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { Pagination } from "@/components/market/pagination";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { apiPage } from "@/lib/api";
import type { PostView } from "@/lib/community";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  return { title: tr("Community"), description: tr("Photos, videos and stories from kite flyers across Pakistan.") };
}

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ scope?: string; page?: string }> }) {
  const tr = await getT();
  const params = await searchParams;
  const user = await getCurrentUser();
  const scope = params.scope === "following" && user ? "following" : "latest";
  const result = await apiPage<PostView>("/feed", { token: await getAccessToken(), query: { scope, page: params.page, pageSize: 20 } }).catch(() => null);

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold">{tr("Community")}</h1>
        <p className="text-muted">{tr("Share flights, kites you made and tips. Be kind, and keep it safe.")}</p>
      </div>

      {user ? (
        <Composer userName={user.profile?.displayName ?? user.fullName} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
          <p className="text-sm">{tr("Sign in to post, like and comment.")}</p>
          <ButtonLink href="/login?next=/community" size="sm">{tr("Sign in")}</ButtonLink>
        </div>
      )}

      <nav aria-label={tr("Feed")} className="flex gap-1 border-b border-border">
        {[
          { key: "latest", label: tr("Latest") },
          ...(user ? [{ key: "following", label: tr("Following") }] : []),
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "latest" ? "/community" : "/community?scope=following"}
            aria-current={scope === t.key ? "page" : undefined}
            className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted hover:text-ink aria-[current=page]:border-primary aria-[current=page]:text-primary"
          >
            {tr(t.label)}
          </Link>
        ))}
      </nav>

      {!result && <Alert tone="error">{tr("The feed could not load. Please refresh the page.")}</Alert>}
      {result && result.data.length === 0 && (
        <EmptyState
          title={scope === "following" ? tr("Nothing from people you follow yet") : tr("No posts yet")}
          message={scope === "following" ? tr("Follow flyers from the Latest feed to see their posts here.") : tr("Be the first to share something.")}
        />
      )}
      {result && result.data.length > 0 && (
        <>
          <div className="grid gap-4">{result.data.map((p) => <PostCard key={p.id} post={p} />)}</div>
          <Pagination meta={result.meta} basePath="/community" params={{ scope: scope === "following" ? "following" : undefined }} />
        </>
      )}
    </div>
  );
}
