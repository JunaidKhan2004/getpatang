import { execSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';

/**
 * Builds the test databases once per run: a migrated and seeded template, and a copy with demo data.
 * Each test file then copies one (see setup-app.ts) instead of migrating and seeding on its own,
 * which keeps parallel runs fast and stops setup time-outs.
 */
export const TEMPLATE = 'test-template';
export const TEMPLATE_DEMO = 'test-template-demo';

const files = (name: string) => [`prisma/${name}.db`, `prisma/${name}.db-journal`];

export default function setup() {
  const base = {
    ...process.env,
    SEED_ADMIN_EMAIL: 'admin@test.local',
    SEED_ADMIN_PASSWORD: 'AdminPass123',
  };
  for (const f of [...files(TEMPLATE), ...files(TEMPLATE_DEMO)]) rmSync(f, { force: true });

  const env = { ...base, DATABASE_URL: `file:./${TEMPLATE}.db` };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });

  copyFileSync(`prisma/${TEMPLATE}.db`, `prisma/${TEMPLATE_DEMO}.db`);
  execSync('npx tsx prisma/seed-demo.ts', { env: { ...base, DATABASE_URL: `file:./${TEMPLATE_DEMO}.db` }, stdio: 'ignore' });

  return () => {
    for (const f of [...files(TEMPLATE), ...files(TEMPLATE_DEMO)]) rmSync(f, { force: true });
  };
}
