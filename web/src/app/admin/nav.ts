import {
  BarChart3, CalendarDays, CreditCard, FileClock, FileText, Flag, Gavel, LayoutDashboard, Medal, MessagesSquare, Package,
  Settings, ShoppingCart, Store, Trophy, UserCheck, Users,
} from "lucide-react";

import type { NavItem } from "@/components/dashboard/dashboard-shell";

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users, permission: "users.read" },
  { href: "/admin/sellers", label: "Sellers", icon: UserCheck, permission: "sellers.review" },
  { href: "/admin/shops", label: "Shops", icon: Store, permission: "sellers.review" },
  { href: "/admin/products", label: "Products", icon: Package, permission: "products.moderate" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart, permission: "orders.manage" },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy, permission: "tournaments.manage" },
  { href: "/admin/matches", label: "Matches", icon: Gavel, permission: "matches.officiate" },
  { href: "/admin/rankings", label: "Rankings", icon: Medal, permission: "tournaments.manage" },
  { href: "/admin/events", label: "Events", icon: CalendarDays, permission: "events.manage" },
  { href: "/admin/community", label: "Community", icon: MessagesSquare, permission: "community.moderate" },
  { href: "/admin/reports", label: "Reports", icon: Flag, permission: "reports.handle" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "payments.manage" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "orders.manage" },
  { href: "/admin/content", label: "Content", icon: FileText, permission: "content.manage" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock, permission: "audit.read" },
];
