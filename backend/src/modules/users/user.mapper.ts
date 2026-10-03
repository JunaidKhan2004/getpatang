import { Prisma } from '@prisma/client';

/** Prisma include needed to build a PublicUser. */
export const publicUserInclude = {
  profile: true,
  roles: { select: { role: { select: { key: true } } } },
} satisfies Prisma.UserInclude;

type UserWithRelations = Prisma.UserGetPayload<{ include: typeof publicUserInclude }>;

/** The only user shape that leaves the API. Never includes the password hash. */
export function toPublicUser(u: UserWithRelations) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    isVerified: u.isVerified,
    status: u.status,
    locale: u.locale,
    roles: u.roles.map((r) => r.role.key),
    profile: u.profile
      ? {
          displayName: u.profile.displayName,
          city: u.profile.city,
          bio: u.profile.bio,
          avatarUrl: u.profile.avatarUrl,
        }
      : null,
    createdAt: u.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
