// scripts/test-phase2.ts
// Run with: npx tsx scripts/test-phase2.ts
//
// This script creates a test order so you can test the guests API

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env as fallback
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Debug: check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Make sure .env or .env.local exists.');
  process.exit(1);
}

console.log('✅ DATABASE_URL loaded');

// Setup Prisma with adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Phase 2 Test Script\n');

  // 1. Find the user (most recently created, likely you)
  const user = await prisma.user.findFirst({
    orderBy: { created_at: 'desc' },
  });

  if (!user) {
    console.error('❌ No user found. Please log in first.');
    process.exit(1);
  }
  console.log(`✅ Found user: ${user.email}`);

  // 2. Find the event
  const event = await prisma.event.findFirst({
    orderBy: { created_at: 'desc' },
  });

  if (!event) {
    console.error('❌ No event found. Run seed first.');
    process.exit(1);
  }
  console.log(`✅ Found event: ${event.name}`);

  // 3. Find a product (individual ticket)
  const product = await prisma.product.findFirst({
    where: {
      event_id: event.id,
      kind: 'INDIVIDUAL_TICKET',
    },
  });

  if (!product) {
    console.error('❌ No product found. Run seed first.');
    process.exit(1);
  }
  console.log(`✅ Found product: ${product.name} ($${product.price_cents / 100})`);

  // 4. Find user's table
  const table = await prisma.table.findFirst({
    where: { primary_owner_id: user.id },
    orderBy: { created_at: 'desc' },
  });

  if (!table) {
    console.error('❌ No table found. Create a table first via the API.');
    process.exit(1);
  }
  console.log(`✅ Found table: ${table.name} (${table.slug})`);

  // 5. Check if test order already exists
  let order = await prisma.order.findFirst({
    where: {
      user_id: user.id,
      table_id: table.id,
      notes: 'TEST_ORDER_PHASE2',
    },
  });

  if (order) {
    console.log(`\n📦 Test order already exists: ${order.id}`);
  } else {
    // Create a test order (simulating a completed Stripe payment)
    order = await prisma.order.create({
      data: {
        event_id: event.id,
        user_id: user.id,
        product_id: product.id,
        table_id: table.id,
        quantity: 4, // 4 seats purchased
        amount_cents: product.price_cents * 4,
        status: 'COMPLETED',
        stripe_payment_intent_id: `pi_test_${Date.now()}`, // Fake Stripe ID
        notes: 'TEST_ORDER_PHASE2',
      },
    });
    console.log(`\n✅ Created test order: ${order.id}`);
    console.log(`   - Quantity: ${order.quantity} seats`);
    console.log(`   - Amount: $${order.amount_cents / 100}`);
    console.log(`   - Status: ${order.status}`);
  }

  // 6. Summary for testing
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST DATA FOR GUESTS API');
  console.log('='.repeat(60));
  console.log(`
Copy these values for testing in browser console:

const testData = {
  eventId: '${event.id}',
  tableId: '${table.id}',
  orderId: '${order.id}',
  userId: '${user.id}',
};

// CREATE A GUEST:
fetch('/api/guests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_id: testData.eventId,
    table_id: testData.tableId,
    order_id: testData.orderId,
    email: 'guest1@example.com',
    first_name: 'Test',
    last_name: 'Guest',
  })
}).then(r => r.json()).then(console.log);

// LIST GUESTS:
fetch('/api/guests?table_id=' + testData.tableId)
  .then(r => r.json()).then(console.log);

// After creating, UPDATE a guest (replace GUEST_ID):
fetch('/api/guests/GUEST_ID', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dietary_restrictions: { restrictions: ['vegetarian'], notes: 'No nuts' }
  })
}).then(r => r.json()).then(console.log);

// DELETE a guest (replace GUEST_ID):
fetch('/api/guests/GUEST_ID', { method: 'DELETE' })
  .then(r => r.json()).then(console.log);
`);

  console.log('='.repeat(60));
  console.log('✅ Ready to test! Copy the code above into browser console.\n');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });