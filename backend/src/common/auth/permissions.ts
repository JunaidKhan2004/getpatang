/**
 * Permission catalogue. Endpoints check permissions, not role names,
 * so roles can be re-configured without code changes.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin.access',
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  SELLERS_REVIEW: 'sellers.review',
  SHOP_MANAGE_OWN: 'shop.manage_own',
  PRODUCTS_MODERATE: 'products.moderate',
  ORDERS_MANAGE: 'orders.manage',
  PAYMENTS_MANAGE: 'payments.manage',
  TOURNAMENTS_MANAGE: 'tournaments.manage',
  MATCHES_OFFICIATE: 'matches.officiate',
  MATCH_RESULTS_SUBMIT: 'matches.results_submit',
  EVENTS_MANAGE: 'events.manage',
  COMMUNITY_MODERATE: 'community.moderate',
  CONTENT_MANAGE: 'content.manage',
  REPORTS_HANDLE: 'reports.handle',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'admin.access': 'Sign in to the admin dashboard',
  'users.read': 'View user accounts',
  'users.manage': 'Suspend, ban, restore and verify users',
  'roles.manage': 'Create roles and assign them to users',
  'sellers.review': 'Approve, reject and suspend sellers',
  'shop.manage_own': 'Manage own shop, products and orders',
  'products.moderate': 'Approve, hide and remove products; manage categories',
  'orders.manage': 'View all orders and handle disputes',
  'payments.manage': 'Configure payment methods and handle refunds',
  'tournaments.manage': 'Create tournaments, brackets and schedules',
  'matches.officiate': 'Start and update assigned matches',
  'matches.results_submit': 'Submit official match results',
  'events.manage': 'Create and manage events',
  'community.moderate': 'Hide and remove community content',
  'content.manage': 'Manage banners, featured items, articles and FAQs',
  'reports.handle': 'Investigate and resolve reports',
  'settings.manage': 'Change platform settings',
  'audit.read': 'View audit logs',
};
