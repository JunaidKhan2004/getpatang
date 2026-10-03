import Link from "next/link";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { apiPage, api } from "@/lib/api";
import type { SellerApplication, SellerProduct } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ShopForm } from "./shop-form";

export const metadata = { title: "Shop" };

export default async function SellerShopPage() {
  const token = await getAccessToken();
  const [shop, live] = await Promise.all([
    api<SellerApplication>("/seller/shop", { token }),
    apiPage<SellerProduct>("/seller/products", { token, query: { status: "ACTIVE", pageSize: 100 } }),
  ]);
  return (
    <>
      <PageHeader
        title="Shop"
        description="How your shop looks to customers."
        actions={<Link href={`/shops/${shop.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">View my shop</Link>}
      />
      <ShopForm shop={shop} products={live.data.map((p) => ({ id: p.id, title: p.title }))} />
    </>
  );
}
