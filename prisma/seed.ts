// prisma/seed.ts
import { PrismaClient, ProductKind, ProductTier } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'stepping-stone' },
    update: {},
    create: {
      name: 'Stepping Stone',
      slug: 'stepping-stone',
    },
  });
  console.log('✓ Organization created:', org.name);

  // 2. Super Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@steppingstone.org' },
    update: {},
    create: {
      email: 'admin@steppingstone.org',
      first_name: 'System',
      last_name: 'Admin',
      is_super_admin: true,
    },
  });
  console.log('✓ Super Admin created:', admin.email);

  // 3. Event
  const event = await prisma.event.upsert({
    where: { organization_id_slug: { organization_id: org.id, slug: '2025-gala' } },
    update: {},
    create: {
      organization_id: org.id,
      name: '50th Anniversary Pink Gala',
      slug: '2025-gala',
      description: 'Celebrating 50 years of impact',
      event_date: new Date('2025-10-18T18:00:00Z'),
      venue_name: 'Grand Ballroom',
      venue_address: '123 Main Street, San Francisco, CA',
      is_active: true,
      tickets_on_sale: false,
    },
  });
  console.log('✓ Event created:', event.name);

  // 4. Products
  const products = [
    { name: 'Standard Individual Ticket', kind: ProductKind.INDIVIDUAL_TICKET, tier: ProductTier.STANDARD, price_cents: 25000 },
    { name: 'VIP Individual Ticket', kind: ProductKind.INDIVIDUAL_TICKET, tier: ProductTier.VIP, price_cents: 50000 },
    { name: 'VVIP Individual Ticket', kind: ProductKind.INDIVIDUAL_TICKET, tier: ProductTier.VVIP, price_cents: 75000 },
    { name: 'Standard Full Table', kind: ProductKind.FULL_TABLE, tier: ProductTier.STANDARD, price_cents: 250000 },
    { name: 'VIP Full Table', kind: ProductKind.FULL_TABLE, tier: ProductTier.VIP, price_cents: 500000 },
    { name: 'VVIP Full Table', kind: ProductKind.FULL_TABLE, tier: ProductTier.VVIP, price_cents: 750000 },
    { name: 'Standard Captain Commitment', kind: ProductKind.CAPTAIN_COMMITMENT, tier: ProductTier.STANDARD, price_cents: 0 },
    { name: 'VIP Captain Commitment', kind: ProductKind.CAPTAIN_COMMITMENT, tier: ProductTier.VIP, price_cents: 0 },
    { name: 'VVIP Captain Commitment', kind: ProductKind.CAPTAIN_COMMITMENT, tier: ProductTier.VVIP, price_cents: 0 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: {
        event_id_name: {
          event_id: event.id,
          name: p.name,
        },
      },
      update: {},
      create: {
        event_id: event.id,
        name: p.name,
        kind: p.kind,
        tier: p.tier,
        price_cents: p.price_cents,
        is_active: true,
      },
    });
  }
  console.log('✓ Products created:', products.length);

  // 5. Tags
  const tags = [
    { name: 'VIP', slug: 'vip', color: '#FFD700' },
    { name: 'Sponsor', slug: 'sponsor', color: '#4CAF50' },
    { name: 'Comp', slug: 'comp', color: '#9C27B0' },
    { name: 'Board Member', slug: 'board-member', color: '#2196F3' },
    { name: 'Staff', slug: 'staff', color: '#607D8B' },
    { name: 'First-Time Attendee', slug: 'first-time', color: '#FF9800' },
    { name: 'Corporate', slug: 'corporate', color: '#3F51B5' },
  ];

  for (const t of tags) {
    await prisma.tag.upsert({
      where: { organization_id_slug: { organization_id: org.id, slug: t.slug } },
      update: {},
      create: {
        organization_id: org.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
      },
    });
  }
  console.log('✓ Tags created:', tags.length);

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });