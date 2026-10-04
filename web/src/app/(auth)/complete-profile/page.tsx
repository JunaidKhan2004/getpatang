import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/validation";

import { ProfileForm } from "./profile-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Set up your profile") };
}

export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const t = await getT();
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/complete-profile");
  if (user.profile) redirect(safeNext(next));

  return (
    <>
      <AuthHeading title={t("Set up your profile")} subtitle={t("This is how shops, players and the community will see you.")} />
      <ProfileForm defaultName={user.fullName} next={next ?? ""} />
    </>
  );
}
