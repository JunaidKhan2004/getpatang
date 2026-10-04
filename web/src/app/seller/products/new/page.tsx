import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api } from "@/lib/api";
import type { Category } from "@/lib/market";
import { categoryOptions, type SellerApplication } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductForm } from "../product-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Add product") };
}

export default async function NewProductPage() {
  const t = await getT();
  const [categories, shop] = await Promise.all([
    api<Category[]>("/categories"),
    api<SellerApplication>("/seller/shop", { token: await getAccessToken() }),
  ]);
  return (
    <>
      <PageHeader title={t("Add product")} description={t("Clear photos and an honest description sell best.")} />
      <ProductForm product={null} categories={categoryOptions(categories)} requiresApproval={shop.requireApproval ?? true} />
    </>
  );
}
