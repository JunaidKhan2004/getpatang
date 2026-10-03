/** Mirrors backend/src/modules/users/user.mapper.ts */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isVerified: boolean;
  status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
  roles: string[];
  profile: { displayName: string; city: string | null; bio: string | null; avatarUrl: string | null } | null;
  createdAt: string;
  /** Only on /auth/me. */
  permissions?: string[];
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "TOURNAMENT_MANAGER",
  "MODERATOR",
  "SUPPORT_AGENT",
  "MATCH_OFFICIAL",
];

export const isStaff = (u: PublicUser) => u.roles.some((r) => STAFF_ROLES.includes(r));
export const isSeller = (u: PublicUser) => u.roles.includes("SELLER");

/** Form state returned by server actions. */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  ok?: boolean;
}
