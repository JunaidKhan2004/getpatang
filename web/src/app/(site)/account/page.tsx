import type { Metadata } from "next";
import Link from "next/link";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { requireUser } from "@/lib/session";
import { isSeller, isStaff } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My account") };
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TOURNAMENT_MANAGER: "Tournament Manager",
  MODERATOR: "Moderator",
  SUPPORT_AGENT: "Support Agent",
  MATCH_OFFICIAL: "Match Official",
  SELLER: "Seller",
  CUSTOMER: "Customer",
};

export default async function AccountPage() {
  const t = await getT();
  const user = await requireUser("/account");
  const name = user.profile?.displayName ?? user.fullName;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">{t("My account")}</h1>

      <section className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-surface p-6">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary font-display text-xl font-semibold text-primary-ink">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="font-display text-lg font-semibold">{name}</p>
          <p className="truncate text-sm text-muted">
            {[user.profile?.city, user.email, user.phone].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <Badge key={r} tone="brand">{t(ROLE_LABELS[r] ?? r)}</Badge>
            ))}
          </div>
        </div>
      </section>

      {(isStaff(user) || isSeller(user)) && (
        <section className="grid gap-2 rounded-md border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">{t("Dashboards")}</h2>
          {isStaff(user) && <Link href="/admin" className="font-medium text-primary hover:underline">{t("Open admin dashboard")}</Link>}
          {isSeller(user) && <Link href="/seller" className="font-medium text-primary hover:underline">{t("Open seller dashboard")}</Link>}
        </section>
      )}

      <nav aria-label={t("Account")} className="grid gap-3 sm:grid-cols-2">
        {[
          { href: "/account/orders", title: t("My orders"), body: t("Track, cancel and review your orders.") },
          { href: "/account/wishlist", title: t("Wishlist"), body: t("Products you saved for later.") },
          { href: "/account/tournaments", title: t("My tournaments"), body: t("Registrations, results and your player profile.") },
          { href: "/account/events", title: t("My events"), body: t("Festivals and workshops you registered for.") },
          { href: "/account/designs", title: t("My kite designs"), body: t("Designs you saved in the kite designer.") },
          { href: "/account/custom-orders", title: t("Custom orders"), body: t("Quotes and conversations with shops.") },
          { href: "/account/notifications", title: t("Notification settings"), body: t("Choose in-app and email updates.") },
          ...(isSeller(user) ? [] : [{ href: "/seller", title: t("Sell on GetPatang"), body: t("Open your own shop. Apply in a few minutes.") }]),
        ].map((l) => (
          <Link key={l.href} href={l.href} className="grid gap-1 rounded-md border border-border bg-surface p-5 hover:border-primary">
            <span className="font-display font-semibold">{l.title}</span>
            <span className="text-sm text-muted">{l.body}</span>
          </Link>
        ))}
      </nav>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary">{t("Sign out")}</Button>
      </form>
    </div>
  );
}
