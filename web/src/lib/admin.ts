/** Admin dashboard types. Mirror backend/src/modules/admin. */

import type { OrderStatus, PaymentStatus } from "./market";
import type { PublicUser } from "./types";

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TOURNAMENT_MANAGER: "Tournament Manager",
  MODERATOR: "Moderator",
  SUPPORT_AGENT: "Support Agent",
  MATCH_OFFICIAL: "Match Official",
  SELLER: "Seller",
  CUSTOMER: "Customer",
};

export const USER_STATUS_TONE = { ACTIVE: "success", SUSPENDED: "warning", BANNED: "danger", DELETED: "neutral" } as const;

export interface AdminUserDetail extends PublicUser {
  lastLoginAt: string | null;
  shop: { id: string; name: string; slug: string; status: string } | null;
  counts: { orders: number; posts: number; reviews: number; tournamentEntries: number; reportsFiled: number; reportsAgainst: number; activeSessions: number };
  deliveredSpend: number;
  history: { action: string; entityType: string; metadata: unknown; ipAddress: string | null; createdAt: string; actor: { id: string; fullName: string } | null }[];
}

export interface RoleInfo {
  key: string;
  name: string;
  description: string | null;
  users: number;
  permissions: string[];
  assignable: boolean;
  protected: boolean;
}

export interface AdminOrderRow {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentLabel: string;
  total: number;
  itemCount: number;
  createdAt: string;
  user: { id: string; fullName: string; email: string };
  shop: { id: string; name: string; slug: string };
}

export interface AdminOrderDetail {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentLabel: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode: string | null;
  deliveryMethod: string;
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string | null; city: string; postalCode?: string | null };
  notes: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string; phone: string | null };
  shop: { id: string; name: string; slug: string; phone: string | null; email: string | null };
  items: { id: string; title: string; variantName: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  events: { status: OrderStatus; note: string | null; createdAt: string; actorId: string | null }[];
  payments: { id: string; provider: string; amount: number; status: PaymentStatus; reference: string | null; proofUploadId: string | null; submittedAt: string | null; reviewNote: string | null }[];
  refunds: { id: string; amount: number; status: "PENDING" | "COMPLETED"; reason: string; reference: string | null; createdAt: string }[];
  customRequest: { id: string; number: string } | null;
  canCancel: boolean;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
}

export interface Analytics {
  days: number;
  totals: {
    users: number;
    newUsers: number;
    orders: number;
    grossOrderValue: number;
    deliveredOrders: number;
    deliveredValue: number;
    shops: number;
    liveProducts: number;
    posts: number;
    upcomingEvents: number;
  };
  ordersByStatus: Partial<Record<OrderStatus, number>>;
  topShops: { id?: string; name?: string; slug?: string; orders: number; value: number }[];
  daily: { date: string; signups: number; orders: number; revenue: number }[];
}

export type Queues = Record<"sellerApplications" | "productsPending" | "paymentsToVerify" | "refundsToSend" | "openReports" | "disputes" | "activeTournaments", number | null>;

export interface SettingRow {
  key: string;
  group: string;
  label: string;
  description: string;
  value: unknown;
  default: unknown;
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  required?: string[];
}

export interface ContentPageRow {
  slug: string;
  title: string;
  body: string;
  published: boolean;
  updatedAt: string | null;
}
