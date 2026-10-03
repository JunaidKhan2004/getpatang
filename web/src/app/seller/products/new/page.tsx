import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api } from "@/lib/api";
import type { Category } from "@/lib/market";
import { categoryOptions, type SellerApplication } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductForm } from "../product-form";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const [categories, shop] = await Promise.all([
    api<Category[]>("/categories"),
    api<SellerApplication>("/seller/shop", { token: await getAccessToken() }),
  ]);
  return (
    <>
      <PageHeader title="Add product" description="Clear photos and an honest description sell best." />
      <ProductForm product={null} categories={categoryOptions(categories)} requiresApproval={shop.requireApproval ?? true} />
    </>
  );
}
