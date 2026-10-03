import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api } from "@/lib/api";
import type { SellerApplication } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { PayoutForm } from "./payout-form";

export const metadata = { title: "Settings" };

export default async function SellerSettingsPage() {
  const shop = await api<SellerApplication>("/seller/shop", { token: await getAccessToken() });
  return (
    <>
      <PageHeader title="Settings" description="Payout details for your shop." />
      <PayoutForm shop={shop} />
    </>
  );
}
