import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api, ApiError } from "@/lib/api";
import type { Category } from "@/lib/market";
import { categoryOptions, type SellerApplication, type SellerProduct } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductForm } from "../product-form";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  let product: SellerProduct;
  try {
    product = await api<SellerProduct>(`/seller/products/${encodeURIComponent(id)}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [categories, shop] = await Promise.all([api<Category[]>("/categories"), api<SellerApplication>("/seller/shop", { token })]);

  return (
    <>
      <PageHeader
        title={product.title}
        description={`${product.salesCount} sold · ${product.stock} in stock`}
        actions={product.status === "ACTIVE" ? <Link href={`/products/${product.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">View in shop</Link> : undefined}
      />
      <ProductForm product={product} categories={categoryOptions(categories)} requiresApproval={shop.requireApproval ?? true} />
    </>
  );
}
