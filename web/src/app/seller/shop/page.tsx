import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { apiPage, api } from "@/lib/api";
import type { SellerApplication, SellerProduct } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ShopForm } from "./shop-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Shop") };
}

export default async function SellerShopPage() {
  const t = await getT();
  const token = await getAccessToken();
  const [shop, live] = await Promise.all([
    api<SellerApplication>("/seller/shop", { token }),
    apiPage<SellerProduct>("/seller/products", { token, query: { status: "ACTIVE", pageSize: 100 } }),
  ]);
  return (
    <>
      <PageHeader
        title={t("Shop")}
        description={t("How your shop looks to customers.")}
        actions={<Link href={`/shops/${shop.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">{t("View my shop")}</Link>}
      />
      <ShopForm shop={shop} products={live.data.map((p) => ({ id: p.id, title: p.title }))} />
    </>
  );
}
