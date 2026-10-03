import { Prisma } from '@prisma/client';

const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

/**
 * Case-insensitive "contains" filter that works on both databases:
 * SQLite LIKE is already case-insensitive for ASCII, PostgreSQL needs `mode: insensitive`.
 */
export function textContains(q: string): Prisma.StringFilter {
  // The SQLite client's types have no `mode`, so the PostgreSQL shape is cast.
  return isPostgres ? ({ contains: q, mode: 'insensitive' } as unknown as Prisma.StringFilter) : { contains: q };
}

/** True when Prisma rejected a write because a unique constraint already holds the value. */
export const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
