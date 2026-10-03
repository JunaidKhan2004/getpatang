import { copyFileSync, rmSync } from 'node:fs';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OtpPurpose } from '@prisma/client';
import type { App } from 'supertest/types.js';

import { TEMPLATE, TEMPLATE_DEMO } from './global-setup.js';

export interface SentCode {
  email: string;
  code: string;
  purpose: OtpPurpose;
}

/**
 * Boots the full API against a throwaway SQLite file (prisma/<name>.db, copied from the run's template),
 * never the dev database.
 * Each test file passes its own name so files can run in parallel.
 * Must be called before anything imports PrismaClient (DATABASE_URL is read on import).
 */
export async function setupApp(name: string, opts: { demo?: boolean; throttle?: boolean } = {}) {
  const url = `file:./${name}.db`;
  process.env.DATABASE_URL = url;
  process.env.SEED_ADMIN_EMAIL = 'admin@test.local';
  process.env.SEED_ADMIN_PASSWORD = 'AdminPass123';
  process.env.UPLOAD_DIR = `test-uploads/${name}`;
  if (opts.throttle === false) process.env.THROTTLE_DISABLED = 'true';
  rmSync(`test-uploads/${name}`, { recursive: true, force: true });

  for (const f of [`prisma/${name}.db`, `prisma/${name}.db-journal`]) rmSync(f, { force: true });
  // Templates are migrated and seeded once per run by test/global-setup.ts.
  copyFileSync(`prisma/${opts.demo ? TEMPLATE_DEMO : TEMPLATE}.db`, `prisma/${name}.db`);

  const { AppModule } = await import('../src/app.module.js');
  const { globalValidationPipe } = await import('../src/common/validation.js');
  const { OTP_CHANNEL } = await import('../src/modules/auth/otp/otp-channel.js');

  const sentCodes: SentCode[] = [];
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OTP_CHANNEL)
    .useValue({
      send: async (to: { email: string }, code: string, purpose: OtpPurpose) => void sentCodes.push({ email: to.email, code, purpose }),
    })
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(globalValidationPipe);
  await app.init();

  const lastCode = (email: string, purpose: OtpPurpose) =>
    sentCodes.filter((c) => c.email === email && c.purpose === purpose).at(-1)!.code;

  return { app, sentCodes, lastCode };
}
