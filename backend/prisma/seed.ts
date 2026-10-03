/**
 * Seeds system roles, permissions and the first Super Admin.
 * Safe to run repeatedly: it only adds what is missing and resyncs role permissions.
 *   npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PERMISSION_DESCRIPTIONS } from '../src/common/auth/permissions.js';
import { DEFAULT_ROLE_PERMISSIONS, Role } from '../src/common/auth/roles.js';

const prisma = new PrismaClient();

async function main() {
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }

  for (const [key, def] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { key },
      create: { key, name: def.name, description: def.description },
      update: { name: def.name, description: def.description },
    });
    const permissions = await prisma.permission.findMany({ where: { key: { in: def.permissions } } });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
    ]);
  }
  console.log(`Seeded ${Object.keys(PERMISSION_DESCRIPTIONS).length} permissions and ${Object.keys(DEFAULT_ROLE_PERMISSIONS).length} roles.`);

  // Marketplace categories (admins can edit these later). Prohibited materials such as
  // metal or glass-coated string are deliberately not a category.
  const categories: { name: string; slug: string; description: string; children?: { name: string; slug: string; description: string }[] }[] = [
    {
      name: 'Kites',
      slug: 'kites',
      description: 'Ready-to-fly kites of every size.',
      children: [
        { name: 'Paper Kites', slug: 'paper-kites', description: 'Traditional tissue-paper patang and gudda.' },
        { name: 'Plastic Kites', slug: 'plastic-kites', description: 'Durable, weather-resistant kites.' },
        { name: 'Kids’ Kites', slug: 'kids-kites', description: 'Small, easy-to-fly kites for children.' },
      ],
    },
    { name: 'Charkhis & Spools', slug: 'charkhis-spools', description: 'Hand reels and spools for winding string.' },
    { name: 'Cotton String', slug: 'cotton-string', description: 'Plain cotton flying string. No metal or glass coating.' },
    { name: 'Accessories', slug: 'accessories', description: 'Finger guards, tails, bags and repair kits.' },
    { name: 'Kite-Making Supplies', slug: 'kite-making-supplies', description: 'Tissue paper, bamboo sticks and glue.' },
    { name: 'Custom Kites', slug: 'custom-kites', description: 'Kites made to your own design.' },
  ];
  for (const [i, c] of categories.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, description: c.description, sortOrder: i },
      update: {},
    });
    for (const [j, child] of (c.children ?? []).entries()) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        create: { ...child, parentId: parent.id, sortOrder: j },
        update: {},
      });
    }
  }
  console.log(`Seeded ${categories.length} top-level categories.`);

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping Super Admin.');
    return;
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`Super Admin ${email} already exists.`);
    return;
  }
  await prisma.user.create({
    data: {
      fullName: 'Platform Admin',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      isVerified: true,
      emailVerifiedAt: new Date(),
      profile: { create: { displayName: 'Platform Admin' } },
      roles: {
        create: [{ role: { connect: { key: Role.SUPER_ADMIN } } }, { role: { connect: { key: Role.CUSTOMER } } }],
      },
    },
  });
  console.log(`Created Super Admin ${email}. Change the password after first sign-in.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
