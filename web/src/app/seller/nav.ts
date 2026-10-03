import {
  BarChart3, LayoutDashboard, Package, Palette, Settings, ShoppingCart, Star, Store, Users, Wallet,
} from "lucide-react";

import type { NavItem } from "@/components/dashboard/dashboard-shell";

export const SELLER_NAV: NavItem[] = [
  { href: "/seller", label: "Dashboard", icon: LayoutDashboard },
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ShoppingCart },
  { href: "/seller/custom-orders", label: "Custom Orders", icon: Palette },
  { href: "/seller/shop", label: "Shop", icon: Store },
  { href: "/seller/customers", label: "Customers", icon: Users },
  { href: "/seller/reviews", label: "Reviews", icon: Star },
  { href: "/seller/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/seller/earnings", label: "Earnings", icon: Wallet },
  { href: "/seller/settings", label: "Settings", icon: Settings },
];

