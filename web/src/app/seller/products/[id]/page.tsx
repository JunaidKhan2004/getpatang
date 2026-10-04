import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { api, ApiError } from "@/lib/api";
import type { Category } from "@/lib/market";
import { categoryOptions, type SellerApplication, type SellerProduct } from "@/lib/seller";
import { getAccessToken } from "@/lib/session";

import { ProductForm } from "../product-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Edit product") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
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
        description={t("{salesCount} sold · {stock} in stock", { salesCount: product.salesCount, stock: product.stock })}
        actions={product.status === "ACTIVE" ? <Link href={`/products/${product.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">{t("View in shop")}</Link> : undefined}
      />
      <ProductForm product={product} categories={categoryOptions(categories)} requiresApproval={shop.requireApproval ?? true} />
    </>
  );
}
