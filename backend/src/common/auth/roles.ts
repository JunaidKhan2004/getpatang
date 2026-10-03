import { Permission, PERMISSIONS } from './permissions.js';

/** System roles. Stored in the `roles` table; keys must not change once deployed. */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  TOURNAMENT_MANAGER: 'TOURNAMENT_MANAGER',
  MODERATOR: 'MODERATOR',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  MATCH_OFFICIAL: 'MATCH_OFFICIAL',
  SELLER: 'SELLER',
  CUSTOMER: 'CUSTOMER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Roles that may sign in to the admin dashboard. */
export const STAFF_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN,
  Role.TOURNAMENT_MANAGER,
  Role.MODERATOR,
  Role.SUPPORT_AGENT,
  Role.MATCH_OFFICIAL,
];

/** Default role → permission mapping used by the seed. Admins can change it later in the database. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full access, including roles and platform settings.',
    permissions: Object.values(PERMISSIONS),
  },
  ADMIN: {
    name: 'Admin',
    description: 'Runs day-to-day operations. Cannot change roles.',
    permissions: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.ROLES_MANAGE),
  },
  TOURNAMENT_MANAGER: {
    name: 'Tournament Manager',
    description: 'Creates tournaments and events, schedules matches, assigns officials.',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.TOURNAMENTS_MANAGE,
      PERMISSIONS.MATCHES_OFFICIATE,
      PERMISSIONS.MATCH_RESULTS_SUBMIT,
      PERMISSIONS.EVENTS_MANAGE,
    ],
  },
  MODERATOR: {
    name: 'Moderator',
    description: 'Reviews community posts, products and reports.',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.COMMUNITY_MODERATE,
      PERMISSIONS.PRODUCTS_MODERATE,
      PERMISSIONS.REPORTS_HANDLE,
    ],
  },
  SUPPORT_AGENT: {
    name: 'Support Agent',
    description: 'Helps customers with accounts and orders.',
    permissions: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.USERS_READ, PERMISSIONS.ORDERS_MANAGE, PERMISSIONS.REPORTS_HANDLE],
  },
  MATCH_OFFICIAL: {
    name: 'Match Official',
    description: 'Starts assigned matches and submits official results.',
    permissions: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.MATCHES_OFFICIATE, PERMISSIONS.MATCH_RESULTS_SUBMIT],
  },
  SELLER: {
    name: 'Seller',
    description: 'Manages their own shop, products and orders.',
    permissions: [PERMISSIONS.SHOP_MANAGE_OWN],
  },
  CUSTOMER: {
    name: 'Customer',
    description: 'Default role for every registered user.',
    permissions: [],
  },
};
