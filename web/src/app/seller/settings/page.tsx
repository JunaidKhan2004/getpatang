import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api } from "@/lib/api";
import type { SellerApplication } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { PayoutForm } from "./payout-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Settings") };
}

export default async function SellerSettingsPage() {
  const t = await getT();
  const shop = await api<SellerApplication>("/seller/shop", { token: await getAccessToken() });
  return (
    <>
      <PageHeader title={t("Settings")} description={t("Payout details for your shop.")} />
      <PayoutForm shop={shop} />
    </>
  );
}
