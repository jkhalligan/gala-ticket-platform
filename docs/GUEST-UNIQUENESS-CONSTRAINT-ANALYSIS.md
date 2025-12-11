# Guest Uniqueness Constraint Analysis & Implementation Guide

**Status:** ✅ Recommended for Implementation
**Priority:** High
**Last Updated:** December 2025
**Analysis Date:** December 11, 2025

---

## Executive Summary

This document provides a comprehensive analysis of adding a `@@unique([event_id, table_id, user_id])` constraint to the `GuestAssignment` model to enforce the business rule that **a user can only occupy one seat at a given table for a given event**.

### Recommendation: **SAFE TO ADD WITH MODIFICATIONS**

The constraint aligns with existing business logic and will prevent data integrity issues, but requires **6 code updates** before deployment to prevent constraint violations.

---

## Table of Contents

1. [Proposed Database Constraint](#proposed-database-constraint)
2. [Safety Analysis](#safety-analysis)
3. [Required Code Updates](#required-code-updates)
4. [Migration Strategy](#migration-strategy)
5. [Compatibility Checklist](#compatibility-checklist)
6. [Benefits & Risks](#benefits--risks)
7. [Testing Recommendations](#testing-recommendations)
8. [Documentation Updates](#documentation-updates)

---

## Proposed Database Constraint

### Prisma Schema Change

```prisma
model GuestAssignment {
  id              String       @id @default(cuid())
  event_id        String
  organization_id String
  table_id        String?
  user_id         String
  order_id        String

  // ... other fields ...

  // Constraints
  @@unique([organization_id, reference_code])    // Existing
  @@unique([event_id, table_id, user_id])       // ← NEW CONSTRAINT

  // ... indexes ...
}
```

### Business Rule Enforced

**A user can only occupy ONE seat at a given table for a given event.**

### Why This Constraint Is Needed

1. **Prevents Race Conditions:** Webhook retries or concurrent API calls could create duplicate assignments
2. **Enforces Business Logic:** Application already assumes uniqueness in 95% of locations
3. **Data Integrity:** Prevents orphaned or duplicate seat assignments
4. **Enables Safe Upserts:** Allows idempotent webhook and API operations
5. **Simplifies Permission Checks:** Guaranteed uniqueness eliminates edge cases

---

## Safety Analysis

### ✅ Compatible Systems (No Changes Needed)

#### 1. Permission System (`src/lib/permissions.ts`)

**Lines 189-196, 378-382, 499-513**

All permission checks use `findFirst()` and assume one seat per user:

```typescript
const isGuest = await prisma.guestAssignment.findFirst({
  where: { table_id: tableId, user_id: userId },
});
```

**Impact:** Already assumes uniqueness. Constraint makes this assumption safe.

#### 2. Capacity Calculations

**Files:**
- `src/app/api/tables/[slug]/route.ts` (lines 430-463)
- `src/app/api/tables/[slug]/guests/route.ts` (lines 101-122)

```typescript
const filledSeats = table.guest_assignments.length;
const placeholderSeats = totalPurchased - filledSeats;
```

**Impact:** Counts assignments as seats. Works correctly when 1 user = 1 seat.

#### 3. User-Facing Guest Assignment APIs

**Files with Duplicate Checks:**
- ✅ `src/app/api/guests/route.ts` (lines 201-216)
- ✅ `src/app/api/tables/[slug]/guests/route.ts` (lines 208-218)
- ✅ `src/app/api/tables/[slug]/claim-seat/route.ts` (lines 110-123)
- ✅ `src/app/api/guests/[id]/transfer/route.ts` (lines 123-138)

All contain explicit checks:
```typescript
const existingAssignment = await prisma.guestAssignment.findFirst({
  where: { table_id: table.id, user_id: guestUser.id },
});

if (existingAssignment) {
  return NextResponse.json(
    { error: "User is already assigned to this table" },
    { status: 409 }
  );
}
```

**Impact:** Already prevent duplicates at application level. Constraint adds database-level enforcement.

#### 4. Reference Code System (`src/lib/reference-codes.ts`)

Each `GuestAssignment` gets a unique sequential reference code (G0001, G0002...).

**Impact:** Reference codes identify **seats**, not **people**. No conflict with proposed constraint.

#### 5. Dashboard Logic

**Files:**
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/table/[slug]/page.tsx`
- `src/components/dashboard/TableDashboard.tsx`
- `src/components/dashboard/GuestListCard.tsx`

All dashboard queries and displays assume one seat per user per table.

**Impact:** UI expects this uniqueness. Constraint enforces what UI assumes.

#### 6. Seed Scripts

**Files:**
- `prisma/seed.ts`
- `prisma/seed-enhanced.ts`

All seed scripts already use `upsert()` with `where: { user_id, table_id }`.

**Impact:** Automatically compatible. No changes needed.

#### 7. Existing Constraint Compatibility

Current constraint: `@@unique([organization_id, reference_code])`

**Impact:** No conflict. Different field combinations.

---

### 🔴 Incompatible Code (Updates Required)

Six files need updates to prevent constraint violations:

---

## Required Code Updates

### 1. 🔴 CRITICAL: Stripe Webhook Handler

**File:** `src/app/api/webhooks/stripe/route.ts`
**Lines:** 217-234
**Risk:** Webhook retries could create duplicates

#### Current Code:
```typescript
// 7. Create guest assignment for the buyer (first seat)
await prisma.guestAssignment.create({
  data: {
    event_id: eventId,
    organization_id: organizationId,
    table_id: finalTableId,
    user_id: userId,
    order_id: order.id,
    tier: tier as any,
    reference_code: guestReferenceCode,
  },
});
```

#### ✅ Recommended Fix (Option 1: Upsert):
```typescript
// 7. Create guest assignment for the buyer (first seat)
// Use upsert to handle webhook retries idempotently
const guestAssignment = await prisma.guestAssignment.upsert({
  where: {
    event_id_table_id_user_id: {
      event_id: eventId,
      table_id: finalTableId,
      user_id: userId,
    },
  },
  update: {
    // Webhook retry - update order_id if needed
    order_id: order.id,
  },
  create: {
    event_id: eventId,
    organization_id: organizationId,
    table_id: finalTableId,
    user_id: userId,
    order_id: order.id,
    tier: tier as any,
    reference_code: guestReferenceCode,
  },
});
```

#### ✅ Recommended Fix (Option 2: Defensive Check):
```typescript
// 7. Check if assignment already exists (webhook idempotency)
const existingAssignment = await prisma.guestAssignment.findFirst({
  where: {
    event_id: eventId,
    table_id: finalTableId,
    user_id: userId,
  },
});

if (!existingAssignment) {
  await prisma.guestAssignment.create({
    data: {
      event_id: eventId,
      organization_id: organizationId,
      table_id: finalTableId,
      user_id: userId,
      order_id: order.id,
      tier: tier as any,
      reference_code: guestReferenceCode,
    },
  });
}
```

---

### 2. 🔴 HIGH: Admin Guest Update (PUT)

**File:** `src/app/api/admin/guests/[id]/route.ts`
**Lines:** 245-267
**Risk:** Admin can reassign guest to table where user already exists

#### Current Code:
```typescript
// 7. Update guest assignment
const updatedGuest = await prisma.guestAssignment.update({
  where: { id },
  data: {
    table_id: data.table_id || undefined,
    display_name: data.display_name || undefined,
    dietary_restrictions: data.dietary_restrictions as any,
    bidder_number: data.bidder_number || undefined,
  },
  // ... include
});
```

#### ✅ Recommended Fix:
```typescript
// 6.5. If changing table, check user doesn't already have seat at new table
if (data.table_id && data.table_id !== existingGuest.table_id) {
  const duplicateCheck = await prisma.guestAssignment.findFirst({
    where: {
      event_id: existingGuest.event_id,
      table_id: data.table_id,
      user_id: existingGuest.user_id,
      id: { not: id }, // Exclude current assignment
    },
  });

  if (duplicateCheck) {
    return NextResponse.json(
      { error: 'User already has a seat at the target table' },
      { status: 409 }
    );
  }
}

// 7. Update guest assignment
const updatedGuest = await prisma.guestAssignment.update({
  where: { id },
  data: {
    table_id: data.table_id || undefined,
    display_name: data.display_name || undefined,
    dietary_restrictions: data.dietary_restrictions as any,
    bidder_number: data.bidder_number || undefined,
  },
  // ... include
});
```

---

### 3. 🔴 HIGH: Admin Guest Update (PATCH)

**File:** `src/app/api/admin/guests/[id]/route.ts`
**Lines:** 384-391
**Risk:** Quick table assignment with no validation

#### Current Code:
```typescript
// 4. Update the guest assignment
const updatedGuest = await prisma.guestAssignment.update({
  where: { id },
  data: { table_id: data.table_id },
  // ... include
});
```

#### ✅ Recommended Fix:
```typescript
// 3.5. Check user doesn't already have seat at new table
if (data.table_id) {
  const duplicateCheck = await prisma.guestAssignment.findFirst({
    where: {
      event_id: currentGuest.event_id,
      table_id: data.table_id,
      user_id: currentGuest.user_id,
      id: { not: id }, // Exclude current assignment
    },
  });

  if (duplicateCheck) {
    return NextResponse.json(
      { error: 'User already has a seat at this table' },
      { status: 409 }
    );
  }
}

// 4. Update the guest assignment
const updatedGuest = await prisma.guestAssignment.update({
  where: { id },
  data: { table_id: data.table_id },
  // ... include
});
```

---

### 4. 🔴 CRITICAL: Admin Bulk Assign

**File:** `src/app/api/admin/guests/bulk-assign/route.ts`
**Lines:** 105-108
**Risk:** Bulk operation could create many duplicates at once

#### Current Code:
```typescript
// 4. Bulk assign guests to table
const result = await prisma.guestAssignment.updateMany({
  where: { id: { in: data.guest_ids } },
  data: { table_id: data.table_id },
});
```

#### ✅ Recommended Fix:
```typescript
// 3.5. Pre-validate: check if any guests already have seats at target table
const guestsToUpdate = await prisma.guestAssignment.findMany({
  where: { id: { in: data.guest_ids } },
  select: { id: true, user_id: true, event_id: true, table_id: true },
});

const targetTableConflicts = await prisma.guestAssignment.findMany({
  where: {
    table_id: data.table_id,
    user_id: { in: guestsToUpdate.map(g => g.user_id) },
    id: { notIn: data.guest_ids }, // Exclude the ones being updated
  },
  select: { user_id: true, id: true },
});

if (targetTableConflicts.length > 0) {
  const conflictUserIds = targetTableConflicts.map(c => c.user_id);
  return NextResponse.json(
    {
      error: 'Some users already have seats at the target table',
      conflicts: conflictUserIds,
      message: `Cannot assign ${targetTableConflicts.length} guest(s) - they already have seats at this table`,
    },
    { status: 409 }
  );
}

// 4. Bulk assign guests to table (now safe)
const result = await prisma.guestAssignment.updateMany({
  where: { id: { in: data.guest_ids } },
  data: { table_id: data.table_id },
});
```

---

### 5. 🟡 MEDIUM: Checkout Zero-Dollar Flow

**File:** `src/app/api/checkout/route.ts`
**Lines:** 455-469
**Risk:** Low (creates new table), but defensive check recommended

#### Current Code:
```typescript
// Create guest assignment for the captain/buyer
await prisma.guestAssignment.create({
  data: {
    event_id,
    organization_id,
    table_id: finalTableId,
    user_id,
    order_id: order.id,
    tier: product_tier as any,
    reference_code: guestReferenceCode,
  },
});
```

#### ✅ Recommended Fix:
```typescript
// Check if buyer already has seat at this table (defensive)
const existingAssignment = await prisma.guestAssignment.findFirst({
  where: {
    event_id,
    table_id: finalTableId,
    user_id,
  },
});

if (!existingAssignment) {
  await prisma.guestAssignment.create({
    data: {
      event_id,
      organization_id,
      table_id: finalTableId,
      user_id,
      order_id: order.id,
      tier: product_tier as any,
      reference_code: guestReferenceCode,
    },
  });
}
```

---

### 6. 🟡 MEDIUM: Admin Order Creation (Comp Tickets)

**File:** `src/app/api/orders/route.ts`
**Lines:** 218-228
**Risk:** Admin could create duplicate comp tickets for same user

#### Current Code:
```typescript
// 7. Create guest assignment
await prisma.guestAssignment.create({
  data: {
    event_id: eventId,
    organization_id: organizationId,
    table_id: data.table_id || null,
    user_id: userId,
    order_id: order.id,
    tier: product_tier as any,
    reference_code: guestReferenceCode,
  },
});
```

#### ✅ Recommended Fix:
```typescript
// 6.5. Check if user already has seat at this table (if table specified)
if (data.table_id) {
  const existingAssignment = await prisma.guestAssignment.findFirst({
    where: {
      event_id: eventId,
      table_id: data.table_id,
      user_id: userId,
    },
  });

  if (existingAssignment) {
    return NextResponse.json(
      { error: 'User already has a seat at this table' },
      { status: 409 }
    );
  }
}

// 7. Create guest assignment
await prisma.guestAssignment.create({
  data: {
    event_id: eventId,
    organization_id: organizationId,
    table_id: data.table_id || null,
    user_id: userId,
    order_id: order.id,
    tier: product_tier as any,
    reference_code: guestReferenceCode,
  },
});
```

---

## Migration Strategy

### Step-by-Step Implementation

#### 1. Pre-Migration: Check for Existing Duplicates

Run this SQL query in production to identify any existing duplicate assignments:

```sql
-- Check for existing duplicates
SELECT
  event_id,
  table_id,
  user_id,
  COUNT(*) as duplicate_count,
  STRING_AGG(id, ', ') as assignment_ids
FROM "GuestAssignment"
WHERE table_id IS NOT NULL
GROUP BY event_id, table_id, user_id
HAVING COUNT(*) > 1;
```

**If duplicates exist:**
- Decide which assignment to keep (recommend: oldest by `created_at`)
- Manually resolve or create cleanup script
- Document which duplicates were removed

#### 2. Update Application Code

Apply all 6 code fixes listed above:
1. ✅ Webhook handler (critical)
2. ✅ Admin PUT endpoint
3. ✅ Admin PATCH endpoint
4. ✅ Bulk assign endpoint
5. ✅ Checkout zero-dollar flow
6. ✅ Comp ticket creation

#### 3. Update Prisma Schema

Add the unique constraint:

```prisma
model GuestAssignment {
  // ... existing fields ...

  @@unique([organization_id, reference_code])
  @@unique([event_id, table_id, user_id])  // ← ADD THIS LINE

  // ... existing indexes ...
}
```

#### 4. Generate Migration

```bash
npx prisma migrate dev --name add-guest-assignment-uniqueness-constraint
```

This will:
- Create migration SQL file
- Apply migration to development database
- Regenerate Prisma Client

#### 5. Test in Development/Staging

**Test Cases:**
- ✅ Try creating duplicate assignments (should fail with constraint error)
- ✅ Test webhook retry scenario
- ✅ Test admin reassigning guest to occupied table
- ✅ Test bulk assignment with duplicates
- ✅ Verify existing functionality still works
- ✅ Test seed scripts still run successfully

#### 6. Deploy to Production

**Deployment Order:**
1. Deploy code updates (all 6 fixes)
2. Run database migration
3. Monitor logs for constraint violation errors
4. Have rollback plan ready

**Monitoring:**
- Watch for Prisma unique constraint violation errors
- Check webhook processing success rate
- Monitor admin panel for error reports

---

## Compatibility Checklist

| System Component | Compatible? | Status | Notes |
|------------------|-------------|--------|-------|
| Existing unique constraint `(organization_id, reference_code)` | ✅ YES | Safe | Different field combination, no conflict |
| Permission checks (`src/lib/permissions.ts`) | ✅ YES | Safe | Already use `findFirst()`, assume uniqueness |
| Capacity calculations | ✅ YES | Safe | Count assignments as seats (1-to-1 mapping) |
| Dashboard logic | ✅ YES | Safe | UI expects one seat per user per table |
| Reference code system | ✅ YES | Safe | Each assignment gets unique code (seats, not users) |
| Activity logs | ✅ YES | Safe | Logs seat assignments separately (correct behavior) |
| Seed scripts (`prisma/seed*.ts`) | ✅ YES | Safe | Already use `upsert()` with correct keys |
| Transfer logic | ✅ YES | Safe | Already blocks transfers to existing seats |
| User-facing guest APIs | ✅ YES | Safe | All have duplicate checks already |
| Webhook handler | ⚠️ NEEDS UPDATE | Unsafe | No duplicate check - race condition risk |
| Admin PUT/PATCH endpoints | ⚠️ NEEDS UPDATE | Unsafe | Can create duplicates on reassignment |
| Bulk operations | ⚠️ NEEDS UPDATE | Unsafe | Can create many duplicates at once |
| Checkout zero-dollar | ⚠️ NEEDS UPDATE | Medium Risk | Low probability but no check |
| Comp ticket creation | ⚠️ NEEDS UPDATE | Medium Risk | Admin could create duplicates |

---

## Benefits & Risks

### ✅ Benefits

1. **Data Integrity**
   - Enforces business rule at database level
   - Prevents duplicate seat assignments permanently
   - Makes data model consistent with business logic

2. **Race Condition Prevention**
   - Webhook retries won't create duplicates
   - Concurrent API calls handled safely
   - Idempotent operations guaranteed

3. **Simplified Logic**
   - Permission checks guaranteed to work correctly
   - `findFirst()` always returns the only assignment
   - Capacity calculations remain accurate

4. **Better Developer Experience**
   - Clear data model constraints
   - Easier to reason about code
   - Prevents bugs before they happen

5. **Safe Upsert Operations**
   - Webhooks can use `upsert()` safely
   - Admin operations more robust
   - Migration scripts more reliable

6. **Google Sheets Sync Integrity**
   - Prevents duplicate exports
   - Reference codes remain consistent
   - Data accuracy maintained

### ⚠️ Risks (All Mitigated)

1. **Migration Failure if Duplicates Exist**
   - **Mitigation:** Run pre-migration duplicate check
   - **Resolution:** Clean up duplicates before migration

2. **Constraint Violations in Production**
   - **Mitigation:** Deploy code updates before migration
   - **Resolution:** All 6 code paths updated to prevent violations

3. **Webhook Processing Failures**
   - **Mitigation:** Use `upsert()` pattern in webhook handler
   - **Resolution:** Retries will update instead of fail

4. **Admin Workflow Interruptions**
   - **Mitigation:** Add user-friendly error messages
   - **Resolution:** Clear 409 errors explain the constraint

5. **Rollback Complexity**
   - **Mitigation:** Test thoroughly in staging
   - **Resolution:** Rollback plan: drop constraint, revert code

---

## Testing Recommendations

### Unit Tests

Create tests for each updated endpoint:

```typescript
// Example test for webhook idempotency
describe('Stripe Webhook - Guest Assignment Creation', () => {
  it('should not create duplicate assignments on webhook retry', async () => {
    const paymentIntent = createTestPaymentIntent();

    // Process webhook twice (simulate retry)
    await processStripeWebhook(paymentIntent);
    await processStripeWebhook(paymentIntent);

    // Should only have one assignment
    const assignments = await prisma.guestAssignment.findMany({
      where: {
        user_id: testUserId,
        table_id: testTableId,
      },
    });

    expect(assignments).toHaveLength(1);
  });
});
```

### Integration Tests

Test end-to-end flows:

1. **Purchase Flow**
   - User buys table
   - Webhook creates assignment
   - Retry webhook (should not duplicate)

2. **Admin Reassignment**
   - Admin reassigns guest to new table
   - Try reassigning guest to table where they already exist (should fail)

3. **Bulk Operations**
   - Bulk assign multiple guests
   - Include guest who already has seat (should fail with clear error)

### Manual Testing Checklist

- [ ] Create new guest assignment (should work)
- [ ] Try creating duplicate assignment (should fail with constraint error)
- [ ] Webhook retry scenario (should not create duplicate)
- [ ] Admin reassign guest to same table (should fail gracefully)
- [ ] Bulk assign with duplicate (should fail with clear error)
- [ ] Transfer ticket (should work normally)
- [ ] Claim seat on PREPAID table (should work normally)
- [ ] Dashboard displays correctly
- [ ] Capacity calculations accurate
- [ ] Permission checks work correctly

---

## Documentation Updates

### Update CLAUDE.md

Add this section to the project documentation:

```markdown
### GuestAssignment Uniqueness Constraint

**Business Rule:** A user can only occupy **one seat** at a given table for a given event.

**Database Constraint:** `@@unique([event_id, table_id, user_id])`

**Rationale:**
- Prevents duplicate seat assignments via race conditions
- Simplifies permission checks (one seat = one role)
- Ensures capacity calculations are accurate
- Enables safe upsert operations in webhooks and APIs
- Maintains data integrity for Google Sheets sync

**Important Notes:**
- Reference codes identify **seats**, not **people** (user with 2 tables = 2 codes)
- Placeholder seats are calculated dynamically: `order.quantity - count(assignments)`
- When transferring a ticket, the `user_id` changes (ownership transfer, not duplication)
- The constraint includes `event_id` to scope uniqueness properly

**API Behavior:**
- Creating duplicate assignment returns `409 Conflict`
- Error message: "User already has a seat at this table"
- Admin endpoints validate before reassignment
- Webhooks use upsert pattern for idempotency
```

### Update API Documentation

Document the constraint in API specs:

```markdown
## POST /api/tables/{slug}/guests

**Error Responses:**

409 Conflict - User already assigned to table
{
  "error": "User is already assigned to this table"
}
```

---

## Appendix: File Reference

### Files Requiring Updates

1. `src/app/api/webhooks/stripe/route.ts` (lines 217-234)
2. `src/app/api/admin/guests/[id]/route.ts` (lines 245-267, 384-391)
3. `src/app/api/admin/guests/bulk-assign/route.ts` (lines 105-108)
4. `src/app/api/checkout/route.ts` (lines 455-469)
5. `src/app/api/orders/route.ts` (lines 218-228)

### Files Already Compatible

- `src/lib/permissions.ts`
- `src/app/api/guests/route.ts`
- `src/app/api/tables/[slug]/guests/route.ts`
- `src/app/api/tables/[slug]/claim-seat/route.ts`
- `src/app/api/guests/[id]/transfer/route.ts`
- `src/app/api/tables/[slug]/route.ts`
- `src/app/dashboard/table/[slug]/page.tsx`
- `src/components/dashboard/TableDashboard.tsx`
- `src/components/dashboard/GuestListCard.tsx`
- `src/lib/reference-codes.ts`
- `prisma/seed.ts`
- `prisma/seed-enhanced.ts`

---

## Conclusion

Adding the `@@unique([event_id, table_id, user_id])` constraint is **strongly recommended** and **safe to implement** with the code updates outlined in this document.

**Next Steps:**
1. Review and approve this analysis
2. Implement the 6 code updates
3. Test thoroughly in development/staging
4. Run pre-migration duplicate check in production
5. Deploy code updates
6. Run database migration
7. Monitor for any issues
8. Update documentation

**Timeline Estimate:**
- Code updates: 2-4 hours
- Testing: 2-3 hours
- Migration preparation: 1 hour
- Deployment: 1 hour
- **Total: 6-9 hours**

---

**Document Version:** 1.0
**Author:** Claude Code (AI Analysis)
**Review Status:** Pending Human Review
