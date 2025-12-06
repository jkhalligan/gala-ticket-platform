// prisma/seed.ts
import { 
  PrismaClient, 
  ProductKind, 
  ProductTier, 
  TableType, 
  TableStatus,
  OrderStatus 
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...\n');

  // ==========================================================================
  // 1. Organization
  // ==========================================================================
  const org = await prisma.organization.upsert({
    where: { slug: 'stepping-stone' },
    update: {},
    create: {
      name: 'Stepping Stone',
      slug: 'stepping-stone',
    },
  });
  console.log('✓ Organization created:', org.name);

  // ==========================================================================
  // 2. Super Admin User
  // ==========================================================================
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

  // ==========================================================================
  // 3. Sample Users (for testing)
  // ==========================================================================
  const hostUser = await prisma.user.upsert({
    where: { email: 'host@example.com' },
    update: {},
    create: {
      email: 'host@example.com',
      first_name: 'Sarah',
      last_name: 'Host',
    },
  });

  const captainUser = await prisma.user.upsert({
    where: { email: 'captain@example.com' },
    update: {},
    create: {
      email: 'captain@example.com',
      first_name: 'Mike',
      last_name: 'Captain',
    },
  });

  const guestUser1 = await prisma.user.upsert({
    where: { email: 'guest1@example.com' },
    update: {},
    create: {
      email: 'guest1@example.com',
      first_name: 'Alice',
      last_name: 'Guest',
    },
  });

  const guestUser2 = await prisma.user.upsert({
    where: { email: 'guest2@example.com' },
    update: {},
    create: {
      email: 'guest2@example.com',
      first_name: 'Bob',
      last_name: 'Guest',
    },
  });

  console.log('✓ Sample users created: 4');

  // ==========================================================================
  // 4. Event
  // ==========================================================================
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

  // ==========================================================================
  // 5. Products
  // ==========================================================================
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

  const productRecords: Record<string, { id: string; tier: ProductTier }> = {};
  
  for (const p of products) {
    const product = await prisma.product.upsert({
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
    productRecords[p.name] = { id: product.id, tier: product.tier };
  }
  console.log('✓ Products created:', products.length);

  // ==========================================================================
  // 6. Tags
  // ==========================================================================
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

  // ==========================================================================
  // 7. Sample Tables (with Phase 5 reference_code)
  // ==========================================================================
  
  // PREPAID Table (host bought full table)
  const vipTable = await prisma.table.upsert({
    where: { event_id_slug: { event_id: event.id, slug: 'vip-table' } },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: hostUser.id,
      name: "Sarah's VIP Table",
      slug: 'vip-table',
      welcome_message: 'Welcome to our VIP table! So glad you could join us.',
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: '25-T001',  // Phase 5: reference code for Sheets
    },
  });

  // CAPTAIN_PAYG Table
  const captainTable = await prisma.table.upsert({
    where: { event_id_slug: { event_id: event.id, slug: 'captain-table' } },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: captainUser.id,
      name: "Mike's Captain Table",
      slug: 'captain-table',
      welcome_message: 'Join our table! Each guest pays for their own ticket.',
      type: TableType.CAPTAIN_PAYG,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: '25-T002',  // Phase 5: reference code for Sheets
    },
  });

  // Admin/Sponsor Table
  const sponsorTable = await prisma.table.upsert({
    where: { event_id_slug: { event_id: event.id, slug: 'sponsor-gold' } },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: admin.id,
      name: 'Gold Sponsor Table',
      slug: 'sponsor-gold',
      internal_name: 'Acme Corp - Gold Sponsor',
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      payment_status: 'PAID_OFFLINE',
      payment_notes: 'Invoice #INV-2025-001, paid via wire transfer',
      reference_code: '25-T003',  // Phase 5: reference code for Sheets
    },
  });

  console.log('✓ Tables created: 3');

  // Create table roles
  await prisma.tableUserRole.upsert({
    where: { table_id_user_id_role: { table_id: vipTable.id, user_id: hostUser.id, role: 'OWNER' } },
    update: {},
    create: { table_id: vipTable.id, user_id: hostUser.id, role: 'OWNER' },
  });

  await prisma.tableUserRole.upsert({
    where: { table_id_user_id_role: { table_id: captainTable.id, user_id: captainUser.id, role: 'CAPTAIN' } },
    update: {},
    create: { table_id: captainTable.id, user_id: captainUser.id, role: 'CAPTAIN' },
  });

  await prisma.tableUserRole.upsert({
    where: { table_id_user_id_role: { table_id: sponsorTable.id, user_id: admin.id, role: 'OWNER' } },
    update: {},
    create: { table_id: sponsorTable.id, user_id: admin.id, role: 'OWNER' },
  });

  console.log('✓ Table roles created: 3');

  // ==========================================================================
  // 8. Sample Orders
  // ==========================================================================
  
  // Host bought full VIP table
  const vipTableOrder = await prisma.order.upsert({
    where: { id: 'seed-order-vip-table' },
    update: {},
    create: {
      id: 'seed-order-vip-table',
      event_id: event.id,
      user_id: hostUser.id,
      product_id: productRecords['VIP Full Table'].id,
      table_id: vipTable.id,
      quantity: 10,
      amount_cents: 500000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: 'pi_seed_vip_table',
    },
  });

  // Captain commitment ($0 order)
  const captainOrder = await prisma.order.upsert({
    where: { id: 'seed-order-captain' },
    update: {},
    create: {
      id: 'seed-order-captain',
      event_id: event.id,
      user_id: captainUser.id,
      product_id: productRecords['Standard Captain Commitment'].id,
      table_id: captainTable.id,
      quantity: 1,
      amount_cents: 0,
      status: OrderStatus.COMPLETED,
    },
  });

  // Guest bought individual ticket at captain's table
  const guest1Order = await prisma.order.upsert({
    where: { id: 'seed-order-guest1' },
    update: {},
    create: {
      id: 'seed-order-guest1',
      event_id: event.id,
      user_id: guestUser1.id,
      product_id: productRecords['Standard Individual Ticket'].id,
      table_id: captainTable.id,
      quantity: 1,
      amount_cents: 25000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: 'pi_seed_guest1',
    },
  });

  console.log('✓ Orders created: 3');

  // ==========================================================================
  // 9. Sample Guest Assignments (with Phase 5 fields)
  // ==========================================================================
  
  // Host is seated at their own VIP table
  await prisma.guestAssignment.upsert({
    where: { id: 'seed-guest-host' },
    update: {},
    create: {
      id: 'seed-guest-host',
      event_id: event.id,
      organization_id: org.id,  // Phase 5: denormalized org ID
      table_id: vipTable.id,
      user_id: hostUser.id,
      order_id: vipTableOrder.id,
      tier: ProductTier.VIP,  // Phase 5: snapshot from product
      reference_code: 'G0001',  // Phase 5: reference code for Sheets
    },
  });

  // Second guest at VIP table (invited by host)
  await prisma.guestAssignment.upsert({
    where: { id: 'seed-guest-vip2' },
    update: {},
    create: {
      id: 'seed-guest-vip2',
      event_id: event.id,
      organization_id: org.id,
      table_id: vipTable.id,
      user_id: guestUser2.id,
      order_id: vipTableOrder.id,
      display_name: 'Bobby G',
      tier: ProductTier.VIP,
      reference_code: 'G0002',
    },
  });

  // Captain seated at their table
  await prisma.guestAssignment.upsert({
    where: { id: 'seed-guest-captain' },
    update: {},
    create: {
      id: 'seed-guest-captain',
      event_id: event.id,
      organization_id: org.id,
      table_id: captainTable.id,
      user_id: captainUser.id,
      order_id: captainOrder.id,
      tier: ProductTier.STANDARD,
      reference_code: 'G0003',
    },
  });

  // Guest who paid for themselves at captain's table
  await prisma.guestAssignment.upsert({
    where: { id: 'seed-guest-alice' },
    update: {},
    create: {
      id: 'seed-guest-alice',
      event_id: event.id,
      organization_id: org.id,
      table_id: captainTable.id,
      user_id: guestUser1.id,
      order_id: guest1Order.id,
      dietary_restrictions: { restrictions: ['vegetarian'], notes: 'No nuts please' },
      tier: ProductTier.STANDARD,
      reference_code: 'G0004',
    },
  });

  console.log('✓ Guest assignments created: 4');

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Seed completed successfully!');
  console.log('='.repeat(60));
  console.log(`
Summary:
  - Organization: ${org.name}
  - Event: ${event.name}
  - Products: ${products.length}
  - Tags: ${tags.length}
  - Users: 5 (admin + 4 sample)
  - Tables: 3 (VIP prepaid, Captain PAYG, Sponsor)
  - Orders: 3
  - Guest Assignments: 4

Sample Table Slugs:
  - /tables/vip-table      (PREPAID, 2 guests seated, 8 placeholders)
  - /tables/captain-table  (CAPTAIN_PAYG, 2 guests seated)
  - /tables/sponsor-gold   (PREPAID, admin-owned, no guests yet)

Reference Codes (Phase 5):
  - Tables: 25-T001, 25-T002, 25-T003
  - Guests: G0001, G0002, G0003, G0004
`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });