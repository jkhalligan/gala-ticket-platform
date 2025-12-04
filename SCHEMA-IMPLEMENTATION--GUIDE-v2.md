# Pink Gala Platform – Schema Implementation Guide (v2)

This document accompanies `schema.prisma` and provides implementation guidance.

---

## Quick Start

```bash
# 1. Copy schema to your project
cp schema.prisma /path/to/your/project/prisma/schema.prisma

# 2. Generate migration
npx prisma migrate dev --name init_schema_v2

# 3. Generate Prisma client
npx prisma generate

# 4. Run seed script
npx prisma db seed
```

---

## Seed Script

```typescript
// prisma/seed.ts
import { PrismaClient, TableType, ProductKind, ProductTier, TableStatus, TablePaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

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
      where: { event_id: event.id, name: p.name },
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
    await prisma.$disconnect();
  });
```

Add to `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

---

## Common Queries

### Get Table with Guests and Seat Counts

```typescript
async function getTableWithDetails(tableId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      guest_assignments: {
        include: { 
          user: true, 
          tags: { include: { tag: true } } 
        }
      },
      orders: { where: { status: 'COMPLETED' } },
      tags: { include: { tag: true } },
      user_roles: { include: { user: true } },
      primary_owner: true,
    },
  });

  if (!table) return null;

  const totalPurchased = table.orders.reduce((sum, o) => sum + o.quantity, 0);
  const filledSeats = table.guest_assignments.length;
  const placeholderSeats = totalPurchased - filledSeats;
  const remainingCapacity = table.capacity - totalPurchased;

  return {
    ...table,
    stats: {
      totalPurchased,
      filledSeats,
      placeholderSeats,
      remainingCapacity,
      isFull: remainingCapacity <= 0,
    },
  };
}
```

### Get Unassigned Guests

```typescript
async function getUnassignedGuests(eventId: string) {
  return prisma.guestAssignment.findMany({
    where: {
      event_id: eventId,
      table_id: null,
    },
    include: { 
      user: true, 
      order: true,
    },
    orderBy: { created_at: 'asc' },
  });
}
```

### Seat Price Resolution

```typescript
function getSeatPrice(
  table: { custom_total_price_cents: number | null; seat_price_cents: number | null; capacity: number },
  product: { price_cents: number }
): number {
  // 1. Explicit seat price (including $0 for free)
  if (table.seat_price_cents !== null) {
    return table.seat_price_cents;
  }
  
  // 2. Derive from table total
  if (table.custom_total_price_cents !== null && table.capacity > 0) {
    return Math.round(table.custom_total_price_cents / table.capacity);
  }
  
  // 3. Product catalog price
  return product.price_cents;
}
```

### Check if Promo Code is Valid

```typescript
async function validatePromoCode(eventId: string, code: string) {
  const promo = await prisma.promoCode.findFirst({
    where: {
      event_id: eventId,
      code: code.toUpperCase(),
      is_active: true,
      valid_from: { lte: new Date() },
      OR: [
        { valid_until: null },
        { valid_until: { gte: new Date() } },
      ],
    },
  });

  if (!promo) return { valid: false, reason: 'Code not found or expired' };
  
  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { valid: false, reason: 'Code usage limit reached' };
  }

  return { valid: true, promo };
}
```

### Create Admin Ticket Invitation

```typescript
import { randomBytes } from 'crypto';

async function createTicketInvitation({
  eventId,
  productId,
  invitedEmail,
  customPriceCents,
  tableId,
  adminUserId,
}: {
  eventId: string;
  productId: string;
  invitedEmail: string;
  customPriceCents?: number;
  tableId?: string;
  adminUserId: string;
}) {
  // Find or create user for this email
  let user = await prisma.user.findUnique({ where: { email: invitedEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: invitedEmail },
    });
  }

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const finalPrice = customPriceCents ?? product.price_cents;
  
  const paymentLinkToken = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const order = await prisma.order.create({
    data: {
      event_id: eventId,
      user_id: user.id,
      product_id: productId,
      table_id: tableId,
      quantity: 1,
      amount_cents: finalPrice,
      status: finalPrice === 0 ? 'COMPLETED' : 'AWAITING_PAYMENT',
      is_admin_created: true,
      invited_email: invitedEmail,
      custom_price_cents: customPriceCents,
      payment_link_token: paymentLinkToken,
      payment_link_expires: expiresAt,
    },
  });

  // If free ticket, create GuestAssignment immediately
  if (finalPrice === 0) {
    await prisma.guestAssignment.create({
      data: {
        event_id: eventId,
        table_id: tableId,
        user_id: user.id,
        order_id: order.id,
      },
    });
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      organization_id: (await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).organization_id,
      event_id: eventId,
      actor_id: adminUserId,
      action: 'ORDER_INVITED',
      entity_type: 'ORDER',
      entity_id: order.id,
      metadata: { invited_email: invitedEmail, custom_price_cents: customPriceCents },
    },
  });

  return { order, paymentLink: `/pay/${paymentLinkToken}` };
}
```

### Reassign Guest to Different Table

```typescript
async function reassignGuest({
  guestAssignmentId,
  newTableId,
  adminUserId,
}: {
  guestAssignmentId: string;
  newTableId: string;
  adminUserId: string;
}) {
  const guest = await prisma.guestAssignment.findUniqueOrThrow({
    where: { id: guestAssignmentId },
    include: { table: true },
  });

  const oldTableId = guest.table_id;
  const oldTableName = guest.table?.name;

  const newTable = await prisma.table.findUniqueOrThrow({
    where: { id: newTableId },
  });

  // Update guest assignment
  await prisma.guestAssignment.update({
    where: { id: guestAssignmentId },
    data: { table_id: newTableId },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      organization_id: newTable.event_id, // Need to get org from event
      event_id: guest.event_id,
      actor_id: adminUserId,
      action: 'GUEST_REASSIGNED',
      entity_type: 'GUEST_ASSIGNMENT',
      entity_id: guestAssignmentId,
      metadata: {
        from_table_id: oldTableId,
        from_table_name: oldTableName,
        to_table_id: newTableId,
        to_table_name: newTable.name,
      },
    },
  });

  return { success: true };
}
```

### Resolve SheetRowMapping Entity

```typescript
async function resolveSheetRowEntity(mapping: { entity_type: string; entity_id: string }) {
  switch (mapping.entity_type) {
    case 'TABLE':
      return prisma.table.findUnique({ where: { id: mapping.entity_id } });
    case 'GUEST_ASSIGNMENT':
      return prisma.guestAssignment.findUnique({ 
        where: { id: mapping.entity_id },
        include: { user: true },
      });
    case 'ORDER':
      return prisma.order.findUnique({ where: { id: mapping.entity_id } });
    default:
      return null;
  }
}
```

---

## Permission Check Helper

```typescript
async function checkTablePermission(
  userId: string,
  tableId: string,
  requiredRoles: TableRole[]
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  // Super admins can do anything
  if (user?.is_super_admin) {
    return { allowed: true };
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      user_roles: { where: { user_id: userId } },
      event: { include: { organization: true } },
    },
  });

  if (!table) {
    return { allowed: false, reason: 'Table not found' };
  }

  // Check org admin
  const isOrgAdmin = await prisma.organizationAdmin.findFirst({
    where: { 
      user_id: userId, 
      organization_id: table.event.organization_id 
    },
  });
  if (isOrgAdmin) {
    return { allowed: true };
  }

  // Check table roles
  const userRoles = table.user_roles.map(r => r.role);
  const hasRequiredRole = requiredRoles.some(r => userRoles.includes(r));
  
  if (hasRequiredRole) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Insufficient permissions' };
}
```

---

## Cron Jobs Needed

### 1. Expire Payment Links

```typescript
// Run daily
async function expireOldPaymentLinks() {
  const expired = await prisma.order.updateMany({
    where: {
      status: 'AWAITING_PAYMENT',
      payment_link_expires: { lt: new Date() },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  
  console.log(`Expired ${expired.count} payment links`);
}
```

### 2. Google Sheets Sync

```typescript
// Run every 15 minutes
async function syncSheetsForEvent(eventId: string) {
  // Implementation depends on Google Sheets API setup
  // See Phase 6 documentation
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="https://thepinkgala.org"
```

---

## Next Steps

1. ✅ Schema created (v2)
2. [ ] Run migration: `npx prisma migrate dev --name init_schema_v2`
3. [ ] Run seed: `npx prisma db seed`
4. [ ] Create Zod schemas for API validation
5. [ ] Implement API routes (Phase 2)
6. [ ] Implement Stripe webhooks (Phase 3)
