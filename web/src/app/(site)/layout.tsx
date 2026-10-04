import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { api } from "@/lib/api";
import { getAccessToken, getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const user = await getCurrentUser();
  const token = user ? await getAccessToken() : undefined;
  const [cartCount, unreadCount] = user
    ? await Promise.all([
        api<{ itemCount: number }>("/cart/count", { token }).then((r) => r.itemCount).catch(() => 0),
        api<{ count: number }>("/notifications/unread-count", { token }).then((r) => r.count).catch(() => 0),
      ])
    : [0, 0];
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t("Skip to content")}</a>
      <SiteHeader userName={user ? (user.profile?.displayName ?? user.fullName) : null} cartCount={cartCount} unreadCount={unreadCount} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
