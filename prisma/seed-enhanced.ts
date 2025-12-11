/**
 * Enhanced Seed Data for Table Dashboard Testing
 *
 * Run with:
 * npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-enhanced.ts
 *
 * Assumes:
 * - Organization "stepping-stone" exists
 * - An event for that org exists
 * - Required products (VIP/STANDARD, FULL_TABLE/INDIVIDUAL, CAPTAIN_COMMITMENT) exist
 */

import {
  PrismaClient,
  ProductKind,
  ProductTier,
  TableType,
  TableStatus,
  OrderStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL environment variable.");
  process.exit(1);
}

/**
 * IMPORTANT:
 * Prisma 7 requires a driver adapter for the client engine.
 * This seed uses a hardcoded URL for development convenience.
 * Do not commit production URLs.
 */

const connectionString = "postgresql://postgres:tTWpZD2UyA7uZOFK@db.nixnsscioujphhnjuuyn.supabase.co:5432/postgres";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

// Fixed but “random-looking” guest profiles
const GUEST_PROFILES: { email: string; first_name: string; last_name: string }[] = [
  { email: "guest1@example.com",  first_name: "Olivia",  last_name: "Carter" },
  { email: "guest2@example.com",  first_name: "Mateo",   last_name: "Russo" },
  { email: "guest3@example.com",  first_name: "Jasmine", last_name: "Lee" },
  { email: "guest4@example.com",  first_name: "Declan",  last_name: "Rivera" },
  { email: "guest5@example.com",  first_name: "Sofia",   last_name: "Nguyen" },
  { email: "guest6@example.com",  first_name: "Luca",    last_name: "Martinez" },
  { email: "guest7@example.com",  first_name: "Amelia",  last_name: "Patel" },
  { email: "guest8@example.com",  first_name: "Noah",    last_name: "Kim" },
  { email: "guest9@example.com",  first_name: "Chloe",   last_name: "Walker" },
  { email: "guest10@example.com", first_name: "Ethan",   last_name: "Diaz" },
];

async function main() {
  console.log("🌱 Starting enhanced seed for table dashboard testing...\n");

  // =========================================================================
  // Base Lookups
  // =========================================================================

  const org = await prisma.organization.findFirst({
    where: { slug: "stepping-stone" },
  });
  if (!org) throw new Error("❌ Base organization missing. Run normal seed first.");

  const event = await prisma.event.findFirst({
    where: { organization_id: org.id },
  });
  if (!event) throw new Error("❌ Base event missing. Run normal seed first.");

  const vipIndividual = await prisma.product.findFirst({
    where: { kind: ProductKind.INDIVIDUAL_TICKET, tier: ProductTier.VIP },
  });
  const vipFullTable = await prisma.product.findFirst({
    where: { kind: ProductKind.FULL_TABLE, tier: ProductTier.VIP },
  });
  const standardIndividual = await prisma.product.findFirst({
    where: { kind: ProductKind.INDIVIDUAL_TICKET, tier: ProductTier.STANDARD },
  });
  const standardFullTable = await prisma.product.findFirst({
    where: { kind: ProductKind.FULL_TABLE, tier: ProductTier.STANDARD },
  });
  const captainCommit = await prisma.product.findFirst({
    where: { kind: ProductKind.CAPTAIN_COMMITMENT },
  });

  if (!vipIndividual || !vipFullTable || !standardIndividual || !standardFullTable || !captainCommit) {
    throw new Error("❌ One or more required products are missing. Run base seed first.");
  }

  // =========================================================================
  // Table Owners (existing users reused; new created if needed)
  // =========================================================================
  // Option B: If user exists, keep their names. If not, create with provided names.

  const jere = await prisma.user.upsert({
    where: { email: "jere@avenirthinking.com" },
    update: {}, // preserve existing first/last if present
    create: {
      email: "jere@avenirthinking.com",
      first_name: "Jere",
      last_name: "Halligan",
    },
  });

  const yolo = await prisma.user.upsert({
    where: { email: "jkhalligan@gmail.com" },
    update: {},
    create: {
      email: "jkhalligan@gmail.com",
      first_name: "Yolo",
      last_name: "Owner",
    },
  });

  const michael = await prisma.user.upsert({
    where: { email: "michael@avenirthinking.com" },
    update: {},
    create: {
      email: "michael@avenirthinking.com",
      first_name: "Michael",
      last_name: "Halligan",
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: "jkhalligan@mac.com" },
    update: {},
    create: {
      email: "jkhalligan@mac.com",
      first_name: "Sarah",
      last_name: "Captain",
    },
  });

  const emily = await prisma.user.upsert({
    where: { email: "michaeltoddmoore@gmail.com" },
    update: {},
    create: {
      email: "michaeltoddmoore@gmail.com",
      first_name: "Emily",
      last_name: "Moore",
    },
  });

  // =========================================================================
  // Guest Users (fixed “random” names, predictable @example.com emails)
  // =========================================================================

  const guests = await Promise.all(
    GUEST_PROFILES.map((g) =>
      prisma.user.upsert({
        where: { email: g.email },
        update: {},
        create: {
          email: g.email,
          first_name: g.first_name,
          last_name: g.last_name,
        },
      })
    )
  );

  console.log("✓ Owners + guest users prepared");

  // =========================================================================
  // Scenario 1: Jere's VIP Table - Fully Funded (10/10)
  // =========================================================================

  const jereTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "jere-vip-full" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: jere.id,
      name: "Jere's VIP Table",
      slug: "jere-vip-full",
      welcome_message:
        "Welcome to our table! Looking forward to a great evening supporting Stepping Stone.",
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T010",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: jereTable.id,
        user_id: jere.id,
        role: "OWNER",
      },
    },
    update: {},
    create: {
      table_id: jereTable.id,
      user_id: jere.id,
      role: "OWNER",
    },
  });

  const jereOrder = await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_jere_vip" },
    update: {},
    create: {
      event_id: event.id,
      user_id: jere.id,
      product_id: vipFullTable.id,
      table_id: jereTable.id,
      quantity: 10,
      amount_cents: 500000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_jere_vip",
    },
  });

  // Seat 10 guests (Jere + 9 guests)
  const existing1 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: jereTable.id, user_id: jere.id },
  });
  if (!existing1) {
    await prisma.guestAssignment.create({
      data: {
      event_id: event.id,
      organization_id: org.id,
      table_id: jereTable.id,
      user_id: jere.id,
      order_id: jereOrder.id,
      display_name: `${jere.first_name} ${jere.last_name}`,
      tier: ProductTier.VIP,
      reference_code: "G1001",
    },
    });
  }

  for (let i = 0; i < 9; i++) {
    const guest = guests[i];
    const existing2 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: jereTable.id, user_id: guest.id },
  });
  if (!existing2) {
    await prisma.guestAssignment.create({
      data: {
        event_id: event.id,
        organization_id: org.id,
        table_id: jereTable.id,
        user_id: guest.id,
        order_id: jereOrder.id,
        display_name: `${guest.first_name} ${guest.last_name}`,
        tier: ProductTier.VIP,
        reference_code: `G10${String(i + 2).padStart(2, "0")}`,
      },
    });
  }
  }

  console.log("✓ Scenario 1: Fully funded VIP table (10/10)");

  // =========================================================================
  // Scenario 2: Partial PREPAID Table - Owner: Yolo (6/10)
  // =========================================================================

  const partialTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "yolo-partial" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: yolo.id,
      name: "Yolo's Table",
      slug: "yolo-partial",
      welcome_message:
        "Join us for a wonderful evening! Can't wait to see you there.",
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T011",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: partialTable.id,
        user_id: yolo.id,
        role: "OWNER",
      },
    },
    update: {},
    create: {
      table_id: partialTable.id,
      user_id: yolo.id,
      role: "OWNER",
    },
  });

  const partialOrder = await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_yolo" },
    update: {},
    create: {
      event_id: event.id,
      user_id: yolo.id,
      product_id: standardFullTable.id,
      table_id: partialTable.id,
      quantity: 10,
      amount_cents: 300000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_yolo",
    },
  });

  // 6 seated: owner + 5 guests
  const existing3 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: partialTable.id, user_id: yolo.id },
  });
  if (!existing3) {
    await prisma.guestAssignment.create({
      data: {
      event_id: event.id,
      organization_id: org.id,
      table_id: partialTable.id,
      user_id: yolo.id,
      order_id: partialOrder.id,
      display_name: `${yolo.first_name} ${yolo.last_name}`,
      tier: ProductTier.STANDARD,
      reference_code: "G2001",
    },
    });
  }

  for (let i = 0; i < 5; i++) {
    const guest = guests[i];
    const existing4 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: partialTable.id, user_id: guest.id },
  });
  if (!existing4) {
    await prisma.guestAssignment.create({
      data: {
        event_id: event.id,
        organization_id: org.id,
        table_id: partialTable.id,
        user_id: guest.id,
        order_id: partialOrder.id,
        display_name: `${guest.first_name} ${guest.last_name}`,
        tier: ProductTier.STANDARD,
        reference_code: `G20${String(i + 2).padStart(2, "0")}`,
      },
    });
  }
  }

  console.log("✓ Scenario 2: Partially filled table (6/10)");

  // =========================================================================
  // Scenario 3: Captain PAYG - Captain Paid (Owner: Michael)
  // =========================================================================

  const mikeTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "mike-captain" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: michael.id,
      name: "Michael's Captain Table",
      slug: "mike-captain",
      welcome_message:
        "Hey everyone! Join my table - each person pays for their own ticket.",
      type: TableType.CAPTAIN_PAYG,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T012",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: mikeTable.id,
        user_id: michael.id,
        role: "CAPTAIN",
      },
    },
    update: {},
    create: {
      table_id: mikeTable.id,
      user_id: michael.id,
      role: "CAPTAIN",
    },
  });

  // Captain commitment
  await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_mike_commit" },
    update: {},
    create: {
      event_id: event.id,
      user_id: michael.id,
      product_id: captainCommit.id,
      table_id: mikeTable.id,
      quantity: 1,
      amount_cents: 0,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_mike_commit",
    },
  });

  // Michael buys his own seat
  const mikeSeatOrder = await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_mike_seat" },
    update: {},
    create: {
      event_id: event.id,
      user_id: michael.id,
      product_id: standardIndividual.id,
      table_id: mikeTable.id,
      quantity: 1,
      amount_cents: 25000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_mike_seat",
    },
  });

  const existing5 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: mikeTable.id, user_id: michael.id },
  });
  if (!existing5) {
    await prisma.guestAssignment.create({
      data: {
      event_id: event.id,
      organization_id: org.id,
      table_id: mikeTable.id,
      user_id: michael.id,
      order_id: mikeSeatOrder.id,
      display_name: `${michael.first_name} ${michael.last_name}`,
      tier: ProductTier.STANDARD,
      reference_code: "G3001",
    },
    });
  }

  // 3 paying guests
  for (let i = 0; i < 3; i++) {
    const guest = guests[i];
    const intentId = `pi_seed_mike_guest${i}`;

    const guestOrder = await prisma.order.upsert({
      where: { stripe_payment_intent_id: intentId },
      update: {},
      create: {
        event_id: event.id,
        user_id: guest.id,
        product_id: standardIndividual.id,
        table_id: mikeTable.id,
        quantity: 1,
        amount_cents: 25000,
        status: OrderStatus.COMPLETED,
        stripe_payment_intent_id: intentId,
      },
    });

    const existing6 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: mikeTable.id, user_id: guest.id },
  });
  if (!existing6) {
    await prisma.guestAssignment.create({
      data: {
        event_id: event.id,
        organization_id: org.id,
        table_id: mikeTable.id,
        user_id: guest.id,
        order_id: guestOrder.id,
        display_name: `${guest.first_name} ${guest.last_name}`,
        tier: ProductTier.STANDARD,
        reference_code: `G30${String(i + 2).padStart(2, "0")}`,
      },
    });
  }
  }

  console.log("✓ Scenario 3: Captain PAYG (captain paid)");

  // =========================================================================
  // Scenario 4: Captain PAYG - Captain Unpaid (Owner: Sarah)
  // =========================================================================

  const sarahTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "sarah-captain-unpaid" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: sarah.id,
      name: "Sarah's Captain Table",
      slug: "sarah-captain-unpaid",
      welcome_message:
        "Hey everyone! Join my table for the Pink Gala. It's going to be awesome.",
      type: TableType.CAPTAIN_PAYG,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T013",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: sarahTable.id,
        user_id: sarah.id,
        role: "CAPTAIN",
      },
    },
    update: {},
    create: {
      table_id: sarahTable.id,
      user_id: sarah.id,
      role: "CAPTAIN",
    },
  });

  // Captain commitment (no paid ticket yet)
  await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_sarah_commit" },
    update: {},
    create: {
      event_id: event.id,
      user_id: sarah.id,
      product_id: captainCommit.id,
      table_id: sarahTable.id,
      quantity: 1,
      amount_cents: 0,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_sarah_commit",
    },
  });

  // Two guests have paid anyway
  for (let i = 3; i < 5; i++) {
    const guest = guests[i];
    const intentId = `pi_seed_sarah_guest${i}`;

    const guestOrder = await prisma.order.upsert({
      where: { stripe_payment_intent_id: intentId },
      update: {},
      create: {
        event_id: event.id,
        user_id: guest.id,
        product_id: standardIndividual.id,
        table_id: sarahTable.id,
        quantity: 1,
        amount_cents: 25000,
        status: OrderStatus.COMPLETED,
        stripe_payment_intent_id: intentId,
      },
    });

    const existing7 = await prisma.guestAssignment.findFirst({
    where: { event_id: event.id, table_id: sarahTable.id, user_id: guest.id },
  });
  if (!existing7) {
    await prisma.guestAssignment.create({
      data: {
        event_id: event.id,
        organization_id: org.id,
        table_id: sarahTable.id,
        user_id: guest.id,
        order_id: guestOrder.id,
        display_name: `${guest.first_name} ${guest.last_name}`,
        tier: ProductTier.STANDARD,
        reference_code: `G40${String(i - 2).padStart(2, "0")}`,
      },
    });
  }
  }

  console.log("✓ Scenario 4: Captain unpaid (nudge scenario)");

  // =========================================================================
  // Scenario 5: Emily's Empty PREPAID Table (0/10)
  // =========================================================================

  const emilyTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "emily-empty" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: emily.id,
      name: "Emily's Corporate Table",
      slug: "emily-empty",
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T014",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: emilyTable.id,
        user_id: emily.id,
        role: "OWNER",
      },
    },
    update: {},
    create: {
      table_id: emilyTable.id,
      user_id: emily.id,
      role: "OWNER",
    },
  });

  await prisma.order.upsert({
    where: { stripe_payment_intent_id: "pi_seed_emily" },
    update: {},
    create: {
      event_id: event.id,
      user_id: emily.id,
      product_id: vipFullTable.id,
      table_id: emilyTable.id,
      quantity: 10,
      amount_cents: 500000,
      status: OrderStatus.COMPLETED,
      stripe_payment_intent_id: "pi_seed_emily",
    },
  });

  console.log("✓ Scenario 5: Empty prepaid table (0/10)");

  // =========================================================================
  // Scenario 6: Jere's Additional Tables (Switcher Testing)
  // =========================================================================

  const jereStandardTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "jere-standard" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: jere.id,
      name: "Jere's Standard Table",
      slug: "jere-standard",
      welcome_message: "Another great table for an amazing cause!",
      type: TableType.PREPAID,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T015",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: jereStandardTable.id,
        user_id: jere.id,
        role: "OWNER",
      },
    },
    update: {},
    create: {
      table_id: jereStandardTable.id,
      user_id: jere.id,
      role: "OWNER",
    },
  });

  const jereCaptainTable = await prisma.table.upsert({
    where: {
      event_id_slug: { event_id: event.id, slug: "jere-captain" },
    },
    update: {},
    create: {
      event_id: event.id,
      primary_owner_id: jere.id,
      name: "Jere's Captain Table",
      slug: "jere-captain",
      welcome_message: "Pay-as-you-go table - everyone chips in!",
      type: TableType.CAPTAIN_PAYG,
      status: TableStatus.ACTIVE,
      capacity: 10,
      reference_code: "25-T016",
    },
  });

  await prisma.tableUserRole.upsert({
    where: {
      table_id_user_id_role: {
        table_id: jereCaptainTable.id,
        user_id: jere.id,
        role: "CAPTAIN",
      },
    },
    update: {},
    create: {
      table_id: jereCaptainTable.id,
      user_id: jere.id,
      role: "CAPTAIN",
    },
  });

  console.log("✓ Scenario 6: Jere's additional tables");

  // =========================================================================
  // Summary
  // =========================================================================

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Enhanced seed completed!\n");
  console.log("Test with devAuth:\n");
  console.log("1. VIP Full:        /dashboard/table/jere-vip-full?devAuth=jere@avenirthinking.com");
  console.log("2. Partial PREPAID: /dashboard/table/yolo-partial?devAuth=jkhalligan@gmail.com");
  console.log("3. Captain Paid:    /dashboard/table/mike-captain?devAuth=michael@avenirthinking.com");
  console.log("4. Captain Unpaid:  /dashboard/table/sarah-captain-unpaid?devAuth=jkhalligan@mac.com");
  console.log("5. Empty Table:     /dashboard/table/emily-empty?devAuth=michaeltoddmoore@gmail.com");
  console.log("6. Jere Switcher:   /dashboard/table/jere-vip-full?devAuth=jere@avenirthinking.com\n");
  console.log("=".repeat(70));
}

main()
  .catch((e) => {
    console.error("Enhanced seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
