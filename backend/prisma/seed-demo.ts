/**
 * DEMO DATA FOR DEVELOPMENT ONLY.
 * Creates sample shops, products and a coupon so the marketplace can be explored
 * before the seller platform (Phase 3) exists. Every demo shop says so in its description.
 * Refuses to run when NODE_ENV=production.
 *   npm run db:seed:demo
 */
import { PrismaClient, ProductStatus, ShopStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  console.error('Demo data must never be loaded into production.');
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO_NOTE = 'Demo shop for development — not a real business.';

interface DemoProduct {
  title: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
  description: string;
  specs: [string, string][];
  variants?: { name: string; price?: number; stock: number }[];
}

const shops: { owner: string; name: string; slug: string; city: string; verified: boolean; products: DemoProduct[] }[] = [
  {
    owner: 'Ahmed Kite House',
    name: 'Basant Kite House',
    slug: 'basant-kite-house',
    city: 'Lahore',
    verified: true,
    products: [
      {
        title: 'Classic Gudda Kite, Tissue Paper',
        category: 'paper-kites',
        price: 425,
        compareAtPrice: 500,
        description: 'Hand-made gudda with a bamboo frame and two-tone tissue paper. Balanced for steady flying in light wind.',
        specs: [['Material', 'Tissue paper, bamboo'], ['Wind', 'Light to moderate'], ['Origin', 'Lahore']],
        variants: [
          { name: 'Medium (2 tawa)', stock: 40 },
          { name: 'Large (3 tawa)', price: 550, stock: 18 },
        ],
      },
      {
        title: 'Patang Set, 5 Kites',
        category: 'paper-kites',
        price: 1800,
        stock: 25,
        description: 'Five traditional patang in assorted colours. A good starter set for the season.',
        specs: [['Pieces', '5'], ['Material', 'Tissue paper, bamboo']],
      },
      {
        title: 'Wooden Charkhi, Medium',
        category: 'charkhis-spools',
        price: 950,
        stock: 30,
        description: 'Smooth-turning sheesham wood charkhi with a comfortable grip.',
        specs: [['Wood', 'Sheesham'], ['Capacity', 'About 6 reels of cotton string']],
      },
      {
        title: 'Leather Finger Guards, Pair',
        category: 'accessories',
        price: 350,
        stock: 60,
        description: 'Soft leather guards that protect your fingers while flying. Strongly recommended for every flyer.',
        specs: [['Material', 'Leather'], ['Sizes', 'One size, adjustable']],
      },
    ],
  },
  {
    owner: 'Sana Patang',
    name: 'Rawalpindi Patang Centre',
    slug: 'rawalpindi-patang-centre',
    city: 'Rawalpindi',
    verified: true,
    products: [
      {
        title: 'Plain Cotton String, 6 Reels',
        category: 'cotton-string',
        price: 1200,
        stock: 50,
        description: 'Plain, uncoated cotton string. Safe for recreational flying. No metal, glass or chemical coating.',
        specs: [['Material', '100% cotton'], ['Coating', 'None'], ['Length', 'About 900 m in total']],
      },
      {
        title: 'Weatherproof Plastic Kite',
        category: 'plastic-kites',
        price: 650,
        stock: 0,
        description: 'Light plastic kite that copes with damp weather. Back in stock soon.',
        specs: [['Material', 'Plastic sheet, fibre spars']],
      },
      {
        title: 'Kite Repair Kit',
        category: 'accessories',
        price: 300,
        stock: 45,
        description: 'Tissue patches, glue stick and spare bamboo for quick repairs on the roof.',
        specs: [['Contents', 'Patches, glue, 4 sticks']],
      },
    ],
  },
  {
    owner: 'Karachi Kites Owner',
    name: 'Karachi Kite Works',
    slug: 'karachi-kite-works',
    city: 'Karachi',
    verified: false,
    products: [
      {
        title: 'Kids’ Mini Kite with Handle',
        category: 'kids-kites',
        price: 450,
        stock: 70,
        description: 'Small, colourful kite with a plastic handle and short cotton line. Easy for children to fly.',
        specs: [['Age', '6+ with adult supervision'], ['Line', '30 m cotton']],
        variants: [
          { name: 'Red', stock: 25 },
          { name: 'Green', stock: 25 },
          { name: 'Blue', stock: 20 },
        ],
      },
      {
        title: 'Kite-Making Starter Pack',
        category: 'kite-making-supplies',
        price: 800,
        stock: 35,
        description: 'Everything to make three kites at home: tissue sheets, bamboo sticks, glue and a guide.',
        specs: [['Makes', '3 kites'], ['Includes', 'Paper, bamboo, glue, guide']],
      },
    ],
  },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const sellerRole = await prisma.role.findUnique({ where: { key: 'SELLER' } });
  if (!sellerRole) throw new Error('Run `npm run db:seed` first (roles are missing).');
  const passwordHash = await bcrypt.hash('DemoSeller123', 12);

  for (const s of shops) {
    const email = `${s.slug}@demo.kiteplatform.local`;
    const owner = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        fullName: s.owner,
        email,
        passwordHash,
        isVerified: true,
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: s.owner, city: s.city } },
        roles: { create: [{ role: { connect: { id: sellerRole.id } } }, { role: { connect: { key: 'CUSTOMER' } } }] },
      },
    });

    const shop = await prisma.shop.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        ownerId: owner.id,
        name: s.name,
        slug: s.slug,
        city: s.city,
        description: DEMO_NOTE,
        email,
        status: ShopStatus.APPROVED,
        isVerified: s.verified,
      },
    });

    for (const p of s.products) {
      const slug = slugify(p.title);
      if (await prisma.product.findUnique({ where: { slug } })) continue;
      const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
      await prisma.product.create({
        data: {
          shopId: shop.id,
          categoryId: category.id,
          title: p.title,
          slug,
          description: p.description,
          specifications: p.specs.map(([label, value]) => ({ label, value })),
          shippingInfo: 'Ships within 2 working days. Delivery across Pakistan.',
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          stock: p.stock ?? 0,
          status: ProductStatus.ACTIVE,
          variants: p.variants ? { create: p.variants.map((v) => ({ name: v.name, price: v.price, stock: v.stock })) } : undefined,
        },
      });
    }
  }

  // One open demo tournament. No results are invented: rankings stay empty until matches are played.
  const admin = await prisma.user.findFirst({ where: { roles: { some: { role: { key: 'SUPER_ADMIN' } } } }, select: { id: true } });
  if (admin && !(await prisma.tournament.findUnique({ where: { slug: 'demo-lahore-spring-cup-2027' } }))) {
    const day = 24 * 3600 * 1000;
    await prisma.tournament.create({
      data: {
        slug: 'demo-lahore-spring-cup-2027',
        name: 'Lahore Spring Cup (Demo)',
        description: 'Demo tournament for development — not a real event. A friendly single-elimination cup for paper kite flyers.',
        city: 'Lahore',
        venue: 'Racecourse Park',
        venueAddress: 'Jail Road, Lahore',
        startsAt: new Date(Date.now() + 21 * day),
        registrationOpensAt: new Date(Date.now() - day),
        registrationClosesAt: new Date(Date.now() + 14 * day),
        status: 'PUBLISHED',
        publishedAt: new Date(),
        maxParticipants: 16,
        minAge: 16,
        entryFee: 0,
        prizeInfo: 'Trophy and kite-making kit for the champion and runner-up.',
        rules: 'Single elimination. Each match lasts 10 minutes in the marked area; the kite still flying at the end wins. Officials decide disputes on the field.',
        safetyRules: 'Finger guards are required. Stay inside the marked area. Flying near power lines or roads is not allowed. Under-18s need a guardian present.',
        approvedMaterials: 'Paper kites and plain cotton string only. No metal, glass-coated or chemical string.',
        venueRestrictions: 'No flying outside the fenced field. Parking at Gate 2.',
        permitReference: 'DEMO-PERMIT-0001',
        organizerName: 'Kite Platform Demo Club',
        season: '2027',
        createdById: admin.id,
      },
    });
  }

  // One demo event, clearly marked as such.
  if (admin && !(await prisma.event.findUnique({ where: { slug: 'demo-basant-family-day' } }))) {
    const day = 24 * 3600 * 1000;
    await prisma.event.create({
      data: {
        slug: 'demo-basant-family-day',
        name: 'Basant Family Day (Demo)',
        type: 'festival',
        description: 'Demo event for development — not a real event. A family afternoon of kite flying with food stalls and a beginners’ corner.',
        city: 'Lahore',
        venue: 'Jilani Park',
        startsAt: new Date(Date.now() + 21 * day),
        organizerName: 'Kite Platform (demo)',
        safetyNotes: 'Paper kites and plain cotton string only. No metal, glass-coated or chemical string. Fly only in the marked field, away from roads and power lines.',
        capacity: 200,
        registrationRequired: true,
        maxGuests: 3,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdById: admin.id,
      },
    });
  }

  await prisma.coupon.upsert({
    where: { code: 'DEMO10' },
    update: {},
    create: { code: 'DEMO10', type: 'PERCENT', value: 10, minSubtotal: 1000, maxDiscount: 500 },
  });

  console.log(`Demo data ready: ${shops.length} shops, ${shops.reduce((n, s) => n + s.products.length, 0)} products, coupon DEMO10, 1 open tournament, 1 event.`);
  console.log('Demo seller logins: <shop-slug>@demo.kiteplatform.local / DemoSeller123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
