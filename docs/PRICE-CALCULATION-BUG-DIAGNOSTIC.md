# Price Calculation Bug - Diagnostic Report

**Date:** December 10, 2025
**Status:** Diagnosis Complete - Awaiting Implementation
**Severity:** 🔴 Critical (Blocking Production Checkout)

---

## Executive Summary

**Critical Bug Identified:** The frontend checkout flow is **ALWAYS calculating price × quantity** regardless of product type. For a $5,000 VIP table (10 seats), the system calculates `$5,000 × 10 = $50,000` in THREE separate locations before the backend validation rejects it. The backend fix is working correctly (preventing the order), but the frontend is never informed about product kind, causing incorrect price display.

---

## Bugs Found

### 🔴 Critical Issues (Blocking Checkout & Wrong Display)

#### Bug #1: Frontend Price Calculation Always Multiplies
- **Location:** `src/components/public/checkout/CheckoutSteps.tsx:86`
- **Impact:** Shows $50,000 instead of $5,000 for tables
- **Root Cause:** Line 86 calculates `pricePerTicket * actualQuantity` without checking product kind

#### Bug #2: OrderSummary Component Always Multiplies
- **Location:** `src/components/public/checkout/OrderSummary.tsx:32`
- **Impact:** Displays wrong subtotal in order summary
- **Root Cause:** Line 32 calculates `pricePerTicket * quantity` without product kind awareness

#### Bug #3: Hardcoded Quantity for Tables
- **Location:** `src/components/public/checkout/CheckoutSteps.tsx:74`
- **Impact:** Tables always get quantity=10, which multiplies the price
- **Root Cause:** Line 74 hardcodes `quantity: format === "table" ? 10 : quantity`

### 🟡 High Priority (Wrong Pricing in Other Areas)

#### Bug #4: Waitlist Conversion Always Multiplies
- **Location:** `src/app/api/admin/waitlist/[id]/convert/route.ts:98-99`
- **Impact:** Admin-created orders for tables would be overcharged
- **Root Cause:** Lines 98-99 multiply `product.price_cents * entry.quantity` without checking product kind

### 🟢 Medium Priority (UX/Architecture Issues)

#### Bug #5: Product Kind Not Passed to Frontend
- **Location:** `src/app/(public)/checkout/page.tsx:66`
- **Impact:** Frontend components can't make product-aware decisions
- **Root Cause:** Checkout page fetches product but only extracts `price_cents`, not `kind`

#### Bug #6: No TypeScript Type for Product Kind
- **Location:** Multiple files (CheckoutSteps, OrderSummary)
- **Impact:** No type safety for product-specific logic
- **Root Cause:** Components don't have product kind in their interfaces

---

## Root Cause Analysis

### Primary Issue: **Incorrect Frontend Price Logic**

The checkout page passes **only** `pricePerTicket` to the `CheckoutSteps` component (`src/app/(public)/checkout/page.tsx:135`). The component has no way to know whether this price is:
- ✅ Per-seat price (needs multiplication)
- ❌ Total table price (no multiplication)

### Data Flow Breakdown:

```
1. Database: Product { kind: 'FULL_TABLE', price_cents: 500000 }
                                                         ↓
2. checkout/page.tsx:66 → pricePerTicket = 500000
   [❌ Product kind is DROPPED here]
                                                         ↓
3. CheckoutSteps.tsx:74 → quantity = 10 (for tables)
                                                         ↓
4. CheckoutSteps.tsx:86 → amountCents = 500000 × 10 = 5,000,000
                                                         ↓
5. OrderSummary.tsx:32 → subtotal = 500000 × 10 = 5,000,000
                                                         ↓
6. Display: $50,000 ❌
                                                         ↓
7. API Submission: { quantity: 10, amount: 5000000 }
                                                         ↓
8. Backend checkout/route.ts:149 → calculateSubtotal(product, 10)
   Backend sees product.kind = 'FULL_TABLE' → returns 500000
                                                         ↓
9. Backend validation (route.ts:63) → REJECTS: "Can only purchase 1 table"
                                                         ↓
10. User sees error, frontend still shows $50,000
```

### Contributing Factors:

1. **Frontend doesn't receive product kind** from the checkout page
2. **Hardcoded quantity=10** for tables instead of quantity=1
3. **No product-aware calculation** in frontend components
4. **Backend validation works** but happens too late (after wrong display)

---

## Complete Fix Strategy

### Fix #1: Pass Product Kind to Frontend Components

**File:** `src/app/(public)/checkout/page.tsx`
**Lines:** 64-68
**Priority:** 🔴 Critical

**Current Code:**
```typescript
if (event.products[0]) {
  productId = event.products[0].id
  pricePerTicket = event.products[0].price_cents
}
```

**Proposed Fix:**
```typescript
let productKind: string = "INDIVIDUAL_TICKET";

// ... in the try block where product is fetched ...

if (event.products[0]) {
  productId = event.products[0].id
  productKind = event.products[0].kind  // ADD THIS
  pricePerTicket = event.products[0].price_cents
}
```

**Then update the CheckoutSteps call (line 129-138):**
```typescript
<CheckoutSteps
  eventId={eventId}
  productId={productId}
  productKind={productKind as "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"}  // ADD THIS
  ticketType={tier}
  format={type as "individual" | "table"}
  mode={mode}
  pricePerTicket={pricePerTicket}
  eventName={eventName}
  eventDate={eventDate}
/>
```

**Rationale:** Frontend needs to know product kind to calculate prices correctly.

---

### Fix #2: Update CheckoutSteps Component

**File:** `src/components/public/checkout/CheckoutSteps.tsx`
**Lines:** 44-86
**Priority:** 🔴 Critical

**Current Interface (lines 44-54):**
```typescript
interface CheckoutStepsProps {
  eventId: string
  productId: string
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  mode?: "host" | "captain"
  quantity?: number
  pricePerTicket: number
  eventName?: string
  eventDate?: string
}
```

**Proposed Fix:**
```typescript
interface CheckoutStepsProps {
  eventId: string
  productId: string
  productKind: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"  // ADD THIS
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  mode?: "host" | "captain"
  quantity?: number
  pricePerTicket: number
  eventName?: string
  eventDate?: string
}
```

**Update component function signature (line 56-66):**
```typescript
export function CheckoutSteps({
  eventId,
  productId,
  productKind,  // ADD THIS
  ticketType,
  format,
  mode,
  quantity = 1,
  pricePerTicket,
  eventName,
  eventDate,
}: CheckoutStepsProps) {
```

**Current Quantity Logic (line 74):**
```typescript
quantity: format === "table" ? 10 : quantity,
```

**Proposed Fix:**
```typescript
// For FULL_TABLE, quantity must be 1 (price includes all seats)
// For individual tickets, use provided quantity
quantity: productKind === "FULL_TABLE" ? 1 : (format === "table" ? 10 : quantity),
```

**Current Price Calculation (lines 84-86):**
```typescript
// Calculate actual quantity for pricing
const actualQuantity = format === "table" ? 10 : data.quantity
const amountCents = pricePerTicket * actualQuantity
```

**Proposed Fix:**
```typescript
// Calculate amount based on product kind (matches backend logic)
let amountCents: number;
let displayQuantity: number;

if (productKind === "FULL_TABLE") {
  // For full tables, price_cents is the TOTAL (don't multiply)
  amountCents = pricePerTicket;
  displayQuantity = 10; // For display purposes only (seats included)
} else {
  // For individual tickets, multiply by quantity
  displayQuantity = data.quantity;
  amountCents = pricePerTicket * displayQuantity;
}
```

**Update OrderSummary call (line 202-209):**
```typescript
<OrderSummary
  ticketType={data.ticketType}
  productKind={productKind}  // ADD THIS
  format={data.format}
  quantity={displayQuantity}  // Use displayQuantity instead of actualQuantity
  pricePerTicket={pricePerTicket}
  eventName={eventName}
  eventDate={eventDate}
/>
```

**Rationale:** This matches the backend `calculateSubtotal()` logic exactly.

---

### Fix #3: Update OrderSummary Component

**File:** `src/components/public/checkout/OrderSummary.tsx`
**Lines:** 5-32
**Priority:** 🔴 Critical

**Current Interface (lines 5-14):**
```typescript
interface OrderSummaryProps {
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  quantity: number
  pricePerTicket: number
  discountCents?: number
  promoCode?: string
  eventName?: string
  eventDate?: string
}
```

**Proposed Fix:**
```typescript
interface OrderSummaryProps {
  ticketType: "STANDARD" | "VIP" | "VVIP"
  productKind: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"  // ADD THIS
  format: "individual" | "table"
  quantity: number
  pricePerTicket: number
  discountCents?: number
  promoCode?: string
  eventName?: string
  eventDate?: string
}
```

**Update function signature (line 22-31):**
```typescript
export function OrderSummary({
  ticketType,
  productKind,  // ADD THIS
  format,
  quantity,
  pricePerTicket,
  discountCents = 0,
  promoCode,
  eventName = "Pink Gala 50th Anniversary",
  eventDate = "February 22, 2025",
}: OrderSummaryProps) {
```

**Current Calculation (lines 32-34):**
```typescript
const subtotal = pricePerTicket * quantity
const total = Math.max(0, subtotal - discountCents)
const isTable = format === "table"
```

**Proposed Fix:**
```typescript
// Calculate subtotal based on product kind (matches backend logic)
const subtotal = productKind === "FULL_TABLE"
  ? pricePerTicket
  : pricePerTicket * quantity;

const total = Math.max(0, subtotal - discountCents)
const isTable = format === "table"
```

**Rationale:** Display must match backend calculation to avoid confusion.

---

### Fix #4: Update Waitlist Conversion Route

**File:** `src/app/api/admin/waitlist/[id]/convert/route.ts`
**Lines:** 98-99
**Priority:** 🟡 High

**Current Code:**
```typescript
amount_cents: product.price_cents * entry.quantity,
custom_price_cents: product.price_cents * entry.quantity,
```

**Proposed Fix:**
```typescript
// Calculate amount based on product kind (before line 92)
const amountCents = product.kind === 'FULL_TABLE'
  ? product.price_cents
  : product.price_cents * entry.quantity;

// Then in the order.create call:
amount_cents: amountCents,
custom_price_cents: amountCents,
```

**Rationale:** Admin-created orders must use same calculation logic as checkout.

---

### Fix #5: Add Helper Function to Lib (Optional but Recommended)

**File:** Create new file `src/lib/pricing.ts`
**Priority:** 🟢 Medium (improves maintainability)

**Proposed Code:**
```typescript
/**
 * Calculate order subtotal based on product kind
 * - FULL_TABLE: price is the total (don't multiply by quantity)
 * - INDIVIDUAL_TICKET: price is per-seat (multiply by quantity)
 * - CAPTAIN_COMMITMENT: usually $0, treat like individual tickets
 *
 * This ensures frontend and backend use identical pricing logic.
 */
export function calculateOrderSubtotal(
  productKind: string,
  priceCents: number,
  quantity: number
): number {
  if (productKind === 'FULL_TABLE') {
    return priceCents;
  } else {
    return priceCents * quantity;
  }
}

/**
 * Get display quantity for UI
 * - FULL_TABLE: Show 10 seats (or product capacity)
 * - Others: Show actual quantity
 */
export function getDisplayQuantity(
  productKind: string,
  quantity: number,
  tableCapacity: number = 10
): number {
  return productKind === 'FULL_TABLE' ? tableCapacity : quantity;
}

/**
 * Get order quantity for backend submission
 * - FULL_TABLE: Always 1 (buying one table)
 * - Others: Actual quantity
 */
export function getOrderQuantity(
  productKind: string,
  quantity: number
): number {
  return productKind === 'FULL_TABLE' ? 1 : quantity;
}
```

**Then update all components to import and use these:**
```typescript
import { calculateOrderSubtotal, getDisplayQuantity, getOrderQuantity } from '@/lib/pricing';

// In component:
const amountCents = calculateOrderSubtotal(productKind, pricePerTicket, data.quantity);
const displayQuantity = getDisplayQuantity(productKind, data.quantity);
const orderQuantity = getOrderQuantity(productKind, data.quantity);
```

**Rationale:** DRY principle - one source of truth for pricing logic shared between frontend and backend.

---

## Implementation Order

1. **🔴 Fix #1 first** - Pass productKind from checkout page (blocks everything else)
2. **🔴 Fix #2 second** - Update CheckoutSteps component (fixes core calculation)
3. **🔴 Fix #3 third** - Update OrderSummary component (fixes display)
4. **🟡 Fix #4 fourth** - Fix waitlist conversion (prevents future bugs)
5. **🟢 Fix #5 last** - Create shared pricing library (optional cleanup)

---

## Testing Strategy

### Test Case 1: VIP Full Table Purchase
```
Setup:
- Product: VIP Full Table
- Product Kind: FULL_TABLE
- Price: $5,000 (500,000 cents)
- Database Quantity: Should be 1

Expected Results:
✅ Frontend displays: "$5,000" (not $50,000)
✅ Order Summary shows: "Table of 10 seats" and "$5,000"
✅ Backend receives: quantity=1, amount_cents=500000
✅ Backend validation: PASSES
✅ Stripe charge: $5,000
✅ Database Order record: amount_cents=500000, quantity=1
```

### Test Case 2: VIP Individual Tickets
```
Setup:
- Product: VIP Individual Ticket
- Product Kind: INDIVIDUAL_TICKET
- Price: $500 (50,000 cents)
- Quantity: 2

Expected Results:
✅ Frontend displays: "$1,000"
✅ Order Summary shows: "2 tickets" and "$1,000"
✅ Backend receives: quantity=2, amount_cents=100000
✅ Backend validation: PASSES
✅ Stripe charge: $1,000
✅ Database Order record: amount_cents=100000, quantity=2
```

### Test Case 3: Table with Promo Code (10% off)
```
Setup:
- Product: VIP Full Table
- Price: $5,000
- Promo: 10% off
- Expected Discount: $500

Expected Results:
✅ Frontend displays: "Subtotal $5,000, Discount -$500, Total $4,500"
✅ Backend calculates: subtotal=500000, discount=50000, total=450000
✅ Stripe charge: $4,500
```

### Test Case 4: Waitlist Conversion (Full Table)
```
Setup:
- Admin converts waitlist entry
- Product: VIP Full Table
- Price: $5,000
- Entry Quantity: 10 (seats)

Expected Results:
✅ Order created with: amount_cents=500000 (not 5,000,000)
✅ Payment link shows: $5,000
```

### Manual Testing Checklist

```
[ ] Navigate to /checkout?event=pink-gala-50th&tier=vip&type=table
[ ] Verify Order Summary shows $5,000 (not $50,000)
[ ] Complete checkout form (buyer info)
[ ] Proceed to payment step
[ ] Verify Stripe Elements shows $5,000
[ ] Check browser console for backend logs
[ ] Verify logs show: "💰 Subtotal calculation: { subtotal_cents: 500000 }"
[ ] Complete payment with test card (4242 4242 4242 4242)
[ ] Verify order in database: amount_cents=500000
[ ] Repeat for individual tickets (quantity=2)
[ ] Verify individual tickets multiply correctly ($500 × 2 = $1,000)
[ ] Test promo code with table purchase
[ ] Test promo code with individual ticket purchase
[ ] Test admin waitlist conversion for table
```

---

## Backend Validation (Already Fixed)

### ✅ Working Correctly

**File:** `src/app/api/checkout/route.ts`

The backend already has the correct logic:

1. **Helper Function (lines 30-36):**
```typescript
function calculateSubtotal(product: { kind: string; price_cents: number }, quantity: number): number {
  if (product.kind === 'FULL_TABLE') {
    return product.price_cents;
  } else {
    return product.price_cents * quantity;
  }
}
```

2. **Quantity Validation (lines 62-75):**
```typescript
// Validates FULL_TABLE must have quantity=1
if (product.kind === 'FULL_TABLE' && data.quantity !== 1) {
  return NextResponse.json(
    { error: "Can only purchase 1 table at a time" },
    { status: 400 }
  );
}

// Validates INDIVIDUAL_TICKET quantity 1-10
if (product.kind === 'INDIVIDUAL_TICKET' && (data.quantity < 1 || data.quantity > 10)) {
  return NextResponse.json(
    { error: "Quantity must be between 1 and 10 for individual tickets" },
    { status: 400 }
  );
}
```

3. **Price Calculation (line 116):**
```typescript
const subtotalCents = calculateSubtotal(product, data.quantity);
```

**The backend is working perfectly.** The issue is purely frontend - it's sending `quantity=10` for tables, which the backend correctly rejects.

---

## Questions/Concerns

### 1. **What should `quantity` be for FULL_TABLE orders?**
**Answer:** Backend validation enforces `quantity=1` for FULL_TABLE. The "10 seats" is just for display purposes. The Order record should store:
- `quantity`: 1 (the number of tables purchased)
- `amount_cents`: 500000 (the total price)

### 2. **Should we prevent users from selecting quantity > 1 for tables?**
**Answer:** YES. The frontend should:
- Hide the quantity selector for tables
- Lock quantity to 1 in state
- Display "Table of 10 seats" instead

### 3. **What about CAPTAIN_PAYG tables?**
**Answer:** CAPTAIN_PAYG uses `CAPTAIN_COMMITMENT` products (usually $0). The captain commits to filling seats, and guests pay individually later. No code changes needed for this flow.

### 4. **Should we update the database schema?**
**Answer:** NO. The Product table already has the `kind` field. We just need to USE it in the frontend.

### 5. **Why was this working in development?**
**Answer:** It wasn't - the bug exists in all environments. The backend validation has been preventing bad orders, but users see confusing error messages and wrong prices.

---

## Success Criteria

Your implementation is complete when:

- ✅ VIP Full Table shows $5,000 (not $50,000) in Order Summary
- ✅ Checkout completes successfully without backend rejection
- ✅ Stripe charges the correct amount ($5,000 for table, $1,000 for 2 tickets)
- ✅ Database Order records have correct `amount_cents`
- ✅ Console logs show matching calculations between frontend and backend
- ✅ All test cases pass
- ✅ No TypeScript errors
- ✅ Build completes successfully (`npm run build`)

---

## Related Files Reference

### Files That Need Changes
1. `src/app/(public)/checkout/page.tsx` - Add productKind to props
2. `src/components/public/checkout/CheckoutSteps.tsx` - Fix quantity and calculation
3. `src/components/public/checkout/OrderSummary.tsx` - Fix subtotal calculation
4. `src/app/api/admin/waitlist/[id]/convert/route.ts` - Fix admin order creation

### Files That Are Already Fixed (Backend)
1. `src/app/api/checkout/route.ts` - ✅ Has correct `calculateSubtotal()` helper
2. `src/lib/stripe.ts` - ✅ Has correct client-side initialization

### Files That Don't Need Changes
1. `src/components/public/checkout/Step1_BuyerInfo.tsx` - No price logic
2. `src/components/public/checkout/Step2_GuestChoice.tsx` - No price logic
3. `src/components/public/checkout/Step3_GuestDetails.tsx` - No price logic
4. `src/components/public/checkout/Step4_Payment.tsx` - Receives calculated amount
5. `src/components/public/checkout/SuccessScreen.tsx` - Displays final amount

---

## Architecture Notes

### Current Architecture (Broken)
```
Database → Checkout Page → [productKind DROPPED] → CheckoutSteps → Wrong Price
```

### Fixed Architecture
```
Database → Checkout Page → [productKind PASSED] → CheckoutSteps → Correct Price
                                                         ↓
                                                   OrderSummary → Matches Backend
```

### Pricing Logic Flow (After Fix)
```
1. Frontend: calculateOrderSubtotal(productKind, price, qty)
2. Backend:  calculateSubtotal(product, qty)
3. Stripe:   Receives correct amount
4. Database: Stores correct amount_cents
```

All three layers use the same logic: **if FULL_TABLE, don't multiply; otherwise, multiply**.

---

## Next Steps

1. Review this diagnostic report
2. Confirm the fix strategy
3. Implement fixes in the order specified
4. Run manual tests against test environment
5. Verify all test cases pass
6. Deploy to production

---

**Report Generated:** December 10, 2025
**Last Updated:** December 10, 2025
**Status:** Ready for Implementation
