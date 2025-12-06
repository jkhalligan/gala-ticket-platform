# Sheets Sync Planning Notes

Additional implementation notes for Phase 5 — Sheets Sync Engine.

---

## Schema Changes Required (Pre-Phase 5)

### 1. Add `tier` to GuestAssignment

Snapshot of ticket tier at purchase time. Immutable — avoids join to Order → Product for exports/reporting.

```prisma
model GuestAssignment {
  // ... existing fields
  tier            ProductTier  // STANDARD, VIP, VVIP — snapshot at creation, immutable
}
```

**Set on creation:** Copy from `order.product.tier` when GuestAssignment is created.

---

### 2. Add `reference_code` to Table

Format: `25-T001` (year prefix + T + 3-digit sequential)

```prisma
model Table {
  // ... existing fields
  reference_code  String    // "25-T001", auto-generated, immutable
  
  @@unique([event_id, reference_code])
}
```

**Generation logic:**
```typescript
async function generateTableReferenceCode(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  const year = event.event_date.getFullYear().toString().slice(-2); // "25"
  
  // Find max existing code for this event
  const lastTable = await prisma.table.findFirst({
    where: { event_id: eventId },
    orderBy: { reference_code: 'desc' },
  });
  
  let nextNum = 1;
  if (lastTable?.reference_code) {
    const match = lastTable.reference_code.match(/T(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  
  return `${year}-T${nextNum.toString().padStart(3, '0')}`; // "25-T001"
}
```

---

### 3. Add `reference_code` to GuestAssignment

Format: `G0001` (G + 4-digit sequential, scoped per organization)

```prisma
model GuestAssignment {
  // ... existing fields
  organization_id String       // Denormalized for reference_code scoping
  reference_code  String       // "G0001", auto-generated, immutable
  
  @@unique([organization_id, reference_code])
  @@index([organization_id])
}
```

**Generation logic:**
```typescript
async function generateGuestReferenceCode(organizationId: string): Promise<string> {
  const lastGuest = await prisma.guestAssignment.findFirst({
    where: { organization_id: organizationId },
    orderBy: { reference_code: 'desc' },
  });
  
  let nextNum = 1;
  if (lastGuest?.reference_code) {
    const match = lastGuest.reference_code.match(/G(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  
  return `G${nextNum.toString().padStart(4, '0')}`; // "G0001"
}
```

**Note:** Adding `organization_id` to GuestAssignment is a small denormalization (derivable via Event), but simplifies the unique constraint and avoids joins for code generation.

---

## Table URL Generation (Export-Time)

URLs are built at export time, not stored:

```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL; // e.g., "https://app.pinkgala.org"
const tableUrl = `${baseUrl}/tables/${table.slug}`;
```

Google Sheets auto-detects URLs and makes them clickable.

---

## Export Column Specs

### Tables Sheet

| Column | Source | Notes |
|--------|--------|-------|
| Reference Code | `table.reference_code` | `25-T001` — immutable, use for joins |
| Table Name | `table.name` | Public display name |
| Link | Derived | `{baseUrl}/tables/{slug}` — built on export |
| Table Number | `table.table_number` | Physical venue assignment (editable in Sheets) |
| Type | `table.type` | PREPAID or CAPTAIN_PAYG |
| Status | `table.status` | ACTIVE, CLOSED, ARCHIVED |
| Capacity | `table.capacity` | Max seats |
| Filled | Calculated | Count of GuestAssignments |
| Primary Owner | `table.primary_owner.email` | |

### Guests Sheet

| Column | Source | Notes |
|--------|--------|-------|
| Guest Ref | `guest.reference_code` | `G0001` — immutable, use for joins |
| Name | Derived | `first_name + last_name` or `display_name` |
| Email | `user.email` | |
| Table Ref | `table.reference_code` | `25-T001` — for VLOOKUP joins |
| Tier | `guest.tier` | STANDARD, VIP, VVIP — direct field now |
| Checked In | `guest.checked_in_at` | Null = not checked in |
| Bidder # | `guest.bidder_number` | Editable in Sheets |
| Auction Reg | `guest.auction_registered` | Editable in Sheets |

---

## Key Distinctions

| Field | Purpose | Mutable? |
|-------|---------|----------|
| `reference_code` | Friendly ID for exports/joins | ❌ Immutable |
| `slug` | URL path segment | Rarely changed |
| `table_number` | Physical venue assignment | ✅ Changes as event approaches |

---

## Migration Checklist

- [ ] Add `tier` to GuestAssignment (enum ProductTier)
- [ ] Add `reference_code` to Table (String, unique per event)
- [ ] Add `organization_id` to GuestAssignment (String, indexed)
- [ ] Add `reference_code` to GuestAssignment (String, unique per org)
- [ ] Update GuestAssignment creation logic to set `tier` from product
- [ ] Update Table creation logic to generate `reference_code`
- [ ] Update GuestAssignment creation logic to generate `reference_code`
- [ ] Backfill existing records (if any exist before migration)

---

*Last updated: December 2024*
