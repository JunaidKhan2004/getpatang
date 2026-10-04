/** Marketplace response types. Mirror backend/src/modules/catalog, shopping and orders. */

import { intlLocale, type Lang, translate } from "./i18n/core";
import { currentLang } from "./i18n/current";

export interface ImageRef {
  url: string;
  alt: string | null;
}

export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  hasVariants: boolean;
  image: ImageRef | null;
  ratingAvg: number;
  ratingCount: number;
  inStock: boolean;
  shop: { name: string; slug: string; city: string; isVerified: boolean };
  category: { name: string; slug: string };
}

export interface ShopCard {
  id: string;
  name: string;
  slug: string;
  city: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  productCount?: number;
}

export interface ShopDetail extends ShopCard {
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  productCount: number;
  isFollowing: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  children: Omit<Category, "children">[];
}

export interface ProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  specifications: { label: string; value: string }[];
  shippingInfo: string | null;
  videoUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: ImageRef[];
  variants: { id: string; name: string; price: number; stock: number }[];
  ratingAvg: number;
  ratingCount: number;
  shop: ShopCard & { phone: string | null; description: string | null };
  category: { name: string; slug: string };
  isWishlisted: boolean;
  related: ProductCard[];
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { name: string; city?: string | null };
  product?: { title: string; slug: string };
}

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  title: string;
  variantName: string | null;
  image: ImageRef | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  savedForLater: boolean;
  shop: { id: string; name: string; slug: string; city: string };
  issue: string | null;
}

export interface Cart {
  shops: { shop: CartLine["shop"]; items: CartLine[]; subtotal: number }[];
  savedForLater: CartLine[];
  itemCount: number;
  subtotal: number;
  canCheckout: boolean;
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface DeliveryMethod {
  key: string;
  label: string;
  description: string;
  fee: number;
  freeAbove: number | null;
}

export interface CheckoutOptions {
  deliveryMethods: DeliveryMethod[];
  paymentMethods: { key: string; label: string; description: string }[];
}

export interface Quote {
  deliveryMethod: DeliveryMethod;
  couponCode: string | null;
  shops: { shop: CartLine["shop"]; items: CartLine[]; subtotal: number; shippingFee: number; discount: number; total: number }[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "RETURNED";

export interface OrderSummary {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  shop: { name: string; slug: string };
  items: { title: string; imageUrl: string | null; quantity: number }[];
  itemCount: number;
}

export interface OrderDetail {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  deliveryMethod: string;
  shippingAddress: Omit<Address, "id" | "label" | "isDefault">;
  contactPhone: string;
  notes: string | null;
  shop: { name: string; slug: string; phone: string | null; email: string | null; city: string };
  items: {
    id: string;
    title: string;
    variantName: string | null;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    productSlug: string | null;
    canReview: boolean;
  }[];
  timeline: { status: OrderStatus; note: string | null; createdAt: string }[];
  progress: OrderStatus[];
  payment: {
    method: string;
    label: string;
    status: PaymentStatus;
    instructions: string | null;
    reference: string | null;
    submittedAt: string | null;
    reviewNote: string | null;
    canSubmitProof: boolean;
  } | null;
  refunds: { amount: number; status: "PENDING" | "COMPLETED"; reference: string | null; createdAt: string; processedAt: string | null }[];
  canCancel: boolean;
}

export type PaymentStatus = "PENDING" | "VERIFYING" | "PAID" | "FAILED" | "REFUNDED";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Not paid yet",
  VERIFYING: "Being verified",
  PAID: "Paid",
  FAILED: "Closed",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  VERIFYING: "info",
  PAID: "success",
  FAILED: "neutral",
  REFUNDED: "neutral",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PREPARING: "info",
  SHIPPED: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  RETURNED: "neutral",
};

/** Paid by hand (bank or mobile wallet) and verified by staff from the transaction reference. */
export const MANUAL_TRANSFER_METHODS = ["bank_transfer", "jazzcash", "easypaisa"];
export const isManualTransfer = (method: string | null | undefined) => MANUAL_TRANSFER_METHODS.includes(method ?? "");

export const formatPKR = (n: number, lang: Lang = currentLang()) => translate(lang, "Rs {amount}", { amount: n.toLocaleString("en-PK") });

export const formatDate = (iso: string, withTime = false, lang: Lang = currentLang()) =>
  new Date(iso).toLocaleString(intlLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "numeric", minute: "2-digit" }),
  });
