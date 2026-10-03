import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireUser } from "@/lib/session";
import { isStaff } from "@/lib/types";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Kite Platform" } };

/** UI gate only. Every admin API call is authorised again by the backend. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!isStaff(user)) {
    return (
      <EmptyState
        title="Staff access only"
        message="Your account does not have access to the admin dashboard."
        action={<ButtonLink href="/">Back to home</ButtonLink>}
      />
    );
  }
  return (
    <DashboardShell area="admin" userName={user.profile?.displayName ?? user.fullName} permissions={user.permissions ?? []}>
      {children}
    </DashboardShell>
  );
}
