/** Seller & admin marketplace types. Mirror backend/src/modules/seller and admin. */
import type { Category, OrderStatus } from "./market";

export type ShopStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type ProductStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "HIDDEN" | "REMOVED";

export interface UploadRef {
  id: string;
  url: string | null;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface SellerApplication {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: ShopStatus;
  isVerified: boolean;
  cnicNumber: string | null;
  payoutMethod: string | null;
  payoutAccountTitle: string | null;
  payoutAccountNumber: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  documents: (UploadRef & { type: string })[];
  featuredProductIds?: string[];
  requireApproval?: boolean;
  acceptsCustomOrders?: boolean;
}

export interface SellerProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: ProductStatus;
  reviewNote: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  lowStockAt: number;
  isLowStock: boolean;
  sku: string | null;
  shippingInfo: string | null;
  videoUrl: string | null;
  specifications: { label: string; value: string }[];
  images: { url: string; alt: string | null; uploadId: string | null }[];
  variants: { id: string; name: string; sku: string | null; price: number | null; stock: number }[];
  category: { id: string; name: string };
  isFeatured: boolean;
  salesCount: number;
  updatedAt: string;
}

export interface SellerOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  customerName: string;
  itemCount: number;
}

export interface SellerOrderDetail {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: { fullName: string; phone: string; line1: string; line2: string | null; city: string; postalCode: string | null };
  notes: string | null;
  deliveryMethod: string;
  courierName: string | null;
  trackingNumber: string | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  payment: { method: string; label: string; status: string };
  items: { title: string; variantName: string | null; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number; productSlug: string | null }[];
  timeline: { status: OrderStatus; note: string | null; createdAt: string }[];
  nextStatuses: OrderStatus[];
}

export interface Dashboard {
  days: number;
  totals: {
    periodRevenue: number;
    periodOrders: number;
    averageOrderValue: number;
    periodCustomers: number;
    deliveredRevenue: number;
    deliveredOrders: number;
    pendingOrders: number;
    liveProducts: number;
    customers: number;
  };
  series: { date: string; orders: number; revenue: number }[];
  topProducts: { id?: string; title?: string; slug?: string; unitsSold: number; revenue: number }[];
  lowStock: { id: string; title: string; stock: number; lowOptions: string[] }[];
  recentOrders: { orderNumber: string; status: OrderStatus; total: number; createdAt: string; customerName: string }[];
}

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  PENDING: "Waiting for review",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Changes needed",
  SUSPENDED: "Suspended",
};

export const SHOP_STATUS_TONE: Record<ShopStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Waiting for approval",
  ACTIVE: "Live",
  REJECTED: "Rejected",
  HIDDEN: "Paused",
  REMOVED: "Removed",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  REJECTED: "danger",
  HIDDEN: "neutral",
  REMOVED: "neutral",
};

/** What the seller's button says for each next order status. */
export const ORDER_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Confirm order",
  PREPARING: "Start preparing",
  SHIPPED: "Mark as shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Mark as delivered",
  CANCELLED: "Cancel order",
  RETURNED: "Mark as returned",
};

export const PAYOUT_METHODS = [
  { value: "bank", label: "Bank account (IBAN)" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "Easypaisa" },
];

export const DOCUMENT_LABEL: Record<string, string> = {
  cnic_front: "CNIC (front)",
  cnic_back: "CNIC (back)",
  business_registration: "Business registration",
  other: "Other document",
};

/** Category tree flattened for a <select>, children shown as "Parent › Child". */
export function categoryOptions(categories: Category[]) {
  return categories.flatMap((c) => [{ id: c.id, label: c.name }, ...c.children.map((ch) => ({ id: ch.id, label: `${c.name} › ${ch.name}` }))]);
}
