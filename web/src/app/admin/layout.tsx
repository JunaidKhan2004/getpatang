import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/types";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: t("Admin"), template: "%s · Admin · GetPatang" } };
}

/** UI gate only. Every admin API call is authorised again by the backend. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const user = await requireUser("/admin");
  if (!isStaff(user)) {
    return (
      <EmptyState
        title={t("Staff access only")}
        message={t("Your account does not have access to the admin dashboard.")}
        action={<ButtonLink href="/">{t("Back to home")}</ButtonLink>}
      />
    );
  }
  return (
    <DashboardShell area="admin" userName={user.profile?.displayName ?? user.fullName} permissions={user.permissions ?? []}>
      {children}
    </DashboardShell>
  );
}
