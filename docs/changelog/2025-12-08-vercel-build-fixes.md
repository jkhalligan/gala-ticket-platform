# Vercel Build Fixes - December 8, 2025

## Executive Summary

This update resolves **17 TypeScript compilation errors** that were preventing successful Vercel builds of the Gala Ticket Platform. The errors stemmed from version-specific breaking changes in our bleeding-edge tech stack, particularly around Prisma 7's stricter JSON type handling, Zod 4's API changes, and mismatches between our database schema and outdated API code.

**Impact**: All TypeScript compilation errors are now resolved. The build successfully passes the TypeScript check phase.

**Time to Resolution**: ~1 hour
**Files Modified**: 11 files
**Complexity**: Medium (required understanding of Prisma JSON types, Zod v4, and database schema)

---

## Detailed Changes

### 1. Prisma JSON Field Type Safety (4 fixes)

**Problem**: Prisma 7 has stricter type checking for JSON fields. Direct assignment of complex objects to JSON fields now requires explicit type casting.

**Files Modified**:
- `src/app/api/admin/guests/[id]/route.ts`
- `src/app/api/guests/route.ts`
- `src/lib/sheets/sync.ts`

**Fix Applied**:
```typescript
// Before (TypeScript error)
metadata: metadata

// After (Type-safe)
metadata: metadata as Prisma.InputJsonValue
```

**Additional Import Required**:
```typescript
import { Prisma } from "@prisma/client";
```

### 2. Event Model Schema Mismatch (4 fixes)

**Problem**: API code was querying for `status: "ACTIVE"` but the Event model uses `is_active: boolean` instead.

**Files Modified**:
- `src/app/api/admin/invitations/route.ts`
- `src/app/api/admin/sync/events/route.ts`
- `src/lib/sheets/sync.ts` (2 locations)

**Fix Applied**:
```typescript
// Before (Field doesn't exist)
const event = await prisma.event.findFirst({
  where: { status: "ACTIVE" }
});

// After (Correct field name)
const event = await prisma.event.findFirst({
  where: { is_active: true }
});
```

### 3. Removed Non-Existent User Fields (2 fixes)

**Problem**: User creation was attempting to set `auth_provider` field, which doesn't exist in the User model schema.

**Files Modified**:
- `src/app/api/admin/invitations/route.ts`
- `src/app/api/admin/waitlist/[id]/convert/route.ts`

**Fix Applied**:
```typescript
// Before (Field doesn't exist)
await prisma.user.create({
  data: {
    email,
    auth_provider: "email", // ❌ Not in schema
  },
});

// After (Schema-compliant)
await prisma.user.create({
  data: {
    email,
  },
});
```

### 4. Zod v4 API Breaking Change (1 fix)

**Problem**: Zod v4 renamed `ZodError.errors` to `ZodError.issues`.

**File Modified**: `src/app/api/auth/login/route.ts`

**Fix Applied**:
```typescript
// Before (Zod v3 API)
if (error instanceof z.ZodError) {
  return NextResponse.json(
    { error: error.errors[0]?.message || 'Invalid email' },
    { status: 400 }
  );
}

// After (Zod v4 API)
if (error instanceof z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message || 'Invalid email' },
    { status: 400 }
  );
}
```

### 5. Stripe API Version Update (1 fix)

**Problem**: Stripe SDK required the latest API version for TypeScript compatibility.

**File Modified**: `src/lib/stripe.ts`

**Fix Applied**:
```typescript
// Before (Outdated version)
apiVersion: "2025-04-30.basil"

// After (Current version)
apiVersion: "2025-11-17.clover"
```

### 6. Checkout Route Type Safety (3 fixes)

**Problem**: Type mismatch between `AuthUser` (from `getCurrentUser()`) and raw Prisma `User` objects when handling guest checkout.

**File Modified**: `src/app/api/checkout/route.ts`

**Fix Applied**:
```typescript
// Before (Type conflict)
let buyer = currentUser; // AuthUser type
if (!buyer) {
  buyer = await prisma.user.findUnique(...); // Raw User type
}

// After (Separate variables)
let buyerUserId: string;
let buyerEmail: string;
if (currentUser) {
  buyerUserId = currentUser.id;
  buyerEmail = currentUser.email;
} else {
  let buyer = await prisma.user.findUnique(...);
  if (!buyer) {
    buyer = await prisma.user.create(...);
  }
  buyerUserId = buyer.id;
  buyerEmail = buyer.email;
}
```

**Additional Fixes in Same File**:
- Fixed `createPaymentIntent()` parameter: `amount` → `amount_cents`
- Fixed return value properties: `paymentIntent.id` → `paymentIntent.paymentIntentId`, `client_secret` → `clientSecret`
- Corrected metadata structure to match `CreatePaymentIntentParams` interface

### 7. Null Safety in Sheets Exporter (1 fix)

**Problem**: Accessing `guest.table.event_id` without null check when `table` could be null.

**File Modified**: `src/lib/sheets/exporter.ts`

**Fix Applied**:
```typescript
if (!guest) {
  throw new Error(`Guest not found: ${guestId}`);
}

// Added null check
if (!guest.table) {
  throw new Error(`Guest ${guestId} has no associated table`);
}

await exportEventToSheets({ eventId: guest.table.event_id });
```

### 8. JSON Metadata Type Assertion (1 fix)

**Problem**: Prisma's JSON type needs explicit typing when accessing nested properties.

**File Modified**: `src/lib/sheets/sync.ts`

**Fix Applied**:
```typescript
// Before (Property access on unknown JSON type)
lastSyncSuccess: lastActivity?.metadata?.success === true

// After (Type assertion)
const metadata = lastActivity?.metadata as { success?: boolean } | null;
return {
  lastSync: lastActivity?.created_at || null,
  lastSyncSuccess: metadata?.success === true,
  spreadsheetUrl: client.getSpreadsheetUrl(),
};
```

---

## Code Quality Improvements

### Promo Validation Type Safety

**File**: `src/app/api/checkout/route.ts`

Improved type definition for promo validation to match the return type from `validatePromoCode()`:

```typescript
let promoValidation: {
  valid: boolean;
  error?: string;
  promo_code_id?: string;
  discount_cents: number;
  discount_type?: string;
  discount_value?: number;
} = { valid: true, promo_code_id: undefined, discount_cents: 0 };
```

---

## Lessons Learned

### 1. **Schema as Source of Truth**
Always verify database schema fields before writing queries. Our Event model uses `is_active: boolean`, not `status: string`. This caused multiple errors across the codebase.

**Action Item**: Consider adding schema-aware code generation or stricter linting rules.

### 2. **Prisma 7 JSON Type Strictness**
Prisma 7 requires explicit type casting for JSON fields. This is actually a **good thing** for type safety, but requires awareness during development.

**Best Practice**:
```typescript
import { Prisma } from "@prisma/client";

// Always cast when assigning to JSON fields
metadata: myObject as Prisma.InputJsonValue
```

### 3. **Zod v4 Breaking Changes**
When upgrading Zod from v3 to v4, the `errors` property was renamed to `issues`. This is easy to miss in error handling code.

**Migration Tip**: Search codebase for `.errors[` and replace with `.issues[`.

### 4. **Stripe API Version Pinning**
Stripe's TypeScript types are version-specific. Always pin to a supported API version and update when upgrading the SDK.

### 5. **Type Safety vs. Convenience**
The checkout route originally tried to reuse the same `buyer` variable for both `AuthUser` and raw Prisma `User` types. This was convenient but type-unsafe. Separating into `buyerUserId` and `buyerEmail` is more verbose but eliminates type errors.

### 6. **Null Safety Still Matters**
Even with TypeScript, runtime null checks are essential, especially when working with optional relations in Prisma (e.g., `guest.table?`).

---

## Next Steps

### Immediate Actions
1. ✅ All TypeScript errors resolved
2. 🔄 Address runtime static generation warnings (optional)
3. 🔄 Test checkout flow with new type-safe code
4. 🔄 Verify Sheets sync functionality

### Future Improvements

#### 1. Static Generation Opt-Out
Several admin pages use cookies and should explicitly opt out of static generation:

```typescript
// Add to admin pages
export const dynamic = 'force-dynamic';
```

Affected routes:
- `/admin/*` (all admin pages)
- `/dashboard`

#### 2. Login Page Suspense Boundary
The `/login` page needs a Suspense boundary for `useSearchParams()`:

```typescript
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
```

#### 3. Schema Documentation
Consider adding schema documentation to `CLAUDE.md` to prevent future field name mismatches:

```markdown
## Database Schema Quick Reference

### Event Model
- ✅ `is_active: boolean` (NOT `status: string`)
- ✅ `tickets_on_sale: boolean`

### User Model
- ❌ No `auth_provider` field
- ✅ `supabase_auth_id: string?`
```

#### 4. Type Generation
Explore generating TypeScript types from Prisma schema for better autocomplete and error prevention:

```bash
npx prisma generate
```

#### 5. Migration Testing
Before deploying:
- [ ] Test user registration flow
- [ ] Test checkout with guest users
- [ ] Test admin guest management
- [ ] Test Sheets sync export
- [ ] Verify Stripe webhook handling

---

## Testing Checklist

### Unit Testing
- [ ] Checkout flow with authenticated user
- [ ] Checkout flow with guest user
- [ ] Admin guest updates
- [ ] Promo code validation
- [ ] Sheets sync status

### Integration Testing
- [ ] End-to-end table purchase
- [ ] Guest assignment workflow
- [ ] Activity log creation
- [ ] Stripe webhook handling

### Deployment Verification
- [ ] Vercel build succeeds
- [ ] No runtime errors on production
- [ ] Database migrations applied
- [ ] Environment variables configured

---

## Related Documentation

- [Tech Stack Versions](../TECH-STACK-VERSIONS.md) - Version-specific notes
- [Database Schema](../../prisma/schema.prisma) - Source of truth
- [CLAUDE.md](../../CLAUDE.md) - AI assistant guide

---

## Contributors

- Fixed by: Claude Code Agent
- Reviewed by: [Pending]
- Deployed by: [Pending]

---

**Build Status**: ✅ TypeScript compilation passing
**Date**: December 8, 2025
**Branch**: `fix/vercel-build`
**Commits**: [Pending push]
