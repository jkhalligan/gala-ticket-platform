# Fix #2.5: Add Quantity Selector UI with shadcn/ui

**File:** `src/components/public/checkout/CheckoutSteps.tsx`
**Priority:** 🟡 High (UX improvement)
**Component Used:** shadcn/ui Input with type="number"

---

## Overview

Add a numeric input for individual ticket quantity selection using shadcn/ui components. Tables should show informational text only (no input).

---

## Implementation

### Step 1: Ensure shadcn/ui Input Component is Installed

If not already installed:

```bash
npx shadcn@latest add input
npx shadcn@latest add label
```

This creates:
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`

---

### Step 2: Update CheckoutSteps Component

**File:** `src/components/public/checkout/CheckoutSteps.tsx`

**Add imports at the top:**

```typescript
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
```

**Add the quantity selector in Step 1 (Buyer Info section):**

Find where Step 1 form fields are (after name, email, etc.) and add:

```typescript
{/* Quantity Selector - Only for Individual Tickets */}
{productKind === "INDIVIDUAL_TICKET" && (
  <div className="space-y-2">
    <Label htmlFor="quantity">Number of Tickets</Label>
    <Input
      id="quantity"
      type="number"
      min={1}
      max={10}
      value={data.quantity}
      onChange={(e) => {
        const value = parseInt(e.target.value, 10)
        // Enforce min/max bounds
        if (value >= 1 && value <= 10) {
          setData({ ...data, quantity: value })
        }
      }}
      className="w-full"
      placeholder="1"
    />
    <p className="text-sm text-muted-foreground">
      Select 1-10 tickets
    </p>
  </div>
)}

{/* Table Info - For Full Tables Only */}
{productKind === "FULL_TABLE" && (
  <div className="rounded-lg border border-border bg-muted/50 p-4">
    <p className="text-sm font-medium">Table Purchase</p>
    <p className="text-sm text-muted-foreground mt-1">
      You are purchasing 1 table that includes 10 seats
    </p>
  </div>
)}
```

---

### Step 3: Add Real-Time Price Update

The quantity change should immediately update the Order Summary. This should work automatically if OrderSummary receives `data.quantity` as a prop.

**Verify in CheckoutSteps that OrderSummary receives the current quantity:**

```typescript
<OrderSummary
  ticketType={data.ticketType}
  productKind={productKind}
  format={data.format}
  quantity={displayQuantity}  // ✅ This should update when data.quantity changes
  pricePerTicket={pricePerTicket}
  eventName={eventName}
  eventDate={eventDate}
/>
```

---

### Step 4: Enhanced Version with +/- Buttons (Optional)

For even better UX, you can add increment/decrement buttons:

```typescript
{productKind === "INDIVIDUAL_TICKET" && (
  <div className="space-y-2">
    <Label htmlFor="quantity">Number of Tickets</Label>
    
    <div className="flex items-center gap-2">
      {/* Decrement Button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          const newQty = Math.max(1, data.quantity - 1)
          setData({ ...data, quantity: newQty })
        }}
        disabled={data.quantity <= 1}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* Numeric Input */}
      <Input
        id="quantity"
        type="number"
        min={1}
        max={10}
        value={data.quantity}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10)
          if (!isNaN(value) && value >= 1 && value <= 10) {
            setData({ ...data, quantity: value })
          }
        }}
        className="w-20 text-center"
      />

      {/* Increment Button */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          const newQty = Math.min(10, data.quantity + 1)
          setData({ ...data, quantity: newQty })
        }}
        disabled={data.quantity >= 10}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>

    <p className="text-sm text-muted-foreground">
      Select 1-10 tickets
    </p>
  </div>
)}
```

**If using this enhanced version, add these imports:**

```typescript
import { Button } from "@/components/ui/button"
import { Plus, Minus } from "lucide-react"
```

**And install if needed:**

```bash
npx shadcn@latest add button
```

---

## Mobile Responsiveness

The shadcn/ui Input component is mobile-responsive by default. For the enhanced version with +/- buttons:

```typescript
// On mobile, make the input and buttons larger for touch targets
<div className="flex items-center gap-2 md:gap-3">
  <Button
    size="icon"
    className="h-10 w-10 md:h-9 md:w-9"  // Larger on mobile
    {/* ... */}
  >
    <Minus className="h-5 w-5 md:h-4 md:w-4" />
  </Button>

  <Input
    className="w-20 md:w-24 text-center text-lg md:text-base"  // Larger text on mobile
    {/* ... */}
  />

  <Button
    size="icon"
    className="h-10 w-10 md:h-9 md:w-9"
    {/* ... */}
  >
    <Plus className="h-5 w-5 md:h-4 md:w-4" />
  </Button>
</div>
```

---

## Validation

Add validation to ensure quantity stays within bounds:

```typescript
// Add to CheckoutSteps component
const handleQuantityChange = (newQuantity: number) => {
  // Clamp between 1 and 10
  const clampedQuantity = Math.min(Math.max(1, newQuantity), 10)
  
  setData({ 
    ...data, 
    quantity: clampedQuantity 
  })
}

// Then use in the Input:
<Input
  onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10))}
  {/* ... */}
/>
```

---

## Accessibility

The numeric input should be fully accessible:

```typescript
<div className="space-y-2">
  <Label htmlFor="quantity" className="text-base font-medium">
    Number of Tickets
  </Label>
  
  <Input
    id="quantity"
    type="number"
    min={1}
    max={10}
    value={data.quantity}
    onChange={handleQuantityChange}
    aria-describedby="quantity-description"
    aria-label="Number of tickets to purchase"
    className="w-full"
  />
  
  <p 
    id="quantity-description" 
    className="text-sm text-muted-foreground"
  >
    Select between 1 and 10 tickets
  </p>
</div>
```

**Accessibility Features:**
- ✅ Label properly associated with input
- ✅ aria-describedby links to helper text
- ✅ min/max attributes for screen readers
- ✅ Clear focus states (from shadcn/ui)
- ✅ Keyboard navigation works (arrow keys increment/decrement)

---

## Testing Checklist

### Functional Testing:
- [ ] Individual tickets: Numeric input is visible
- [ ] Full tables: No input shown, informational text displays
- [ ] Typing "5" in input: Works, updates quantity to 5
- [ ] Typing "15" in input: Clamped to 10
- [ ] Typing "0" in input: Clamped to 1
- [ ] Typing non-numeric: Ignored/handled gracefully
- [ ] Order Summary updates in real-time as quantity changes
- [ ] Price calculation updates correctly (qty × price)

### Enhanced Version (with +/- buttons):
- [ ] Clicking + button: Increments quantity
- [ ] Clicking - button: Decrements quantity
- [ ] At quantity=1: - button is disabled
- [ ] At quantity=10: + button is disabled
- [ ] Buttons have visible hover/active states

### Mobile Testing:
- [ ] Input is large enough to tap (min 44×44px touch target)
- [ ] +/- buttons are thumb-friendly
- [ ] Number keyboard appears on mobile devices
- [ ] Input doesn't zoom on focus (font-size ≥ 16px)

### Accessibility Testing:
- [ ] Can tab to input using keyboard
- [ ] Can use arrow keys to increment/decrement
- [ ] Screen reader announces current value
- [ ] Screen reader announces min/max constraints
- [ ] Focus indicator is clearly visible

---

## Expected User Experience

### For Individual Tickets:
```
┌─────────────────────────────────────┐
│ Number of Tickets                   │
│ ┌─────────────────────────────────┐ │
│ │         [  5  ]                 │ │  ← Numeric input, centered
│ └─────────────────────────────────┘ │
│ Select 1-10 tickets                 │
└─────────────────────────────────────┘
```

**Or with +/- buttons:**
```
┌─────────────────────────────────────┐
│ Number of Tickets                   │
│ ┌───┐  ┌─────┐  ┌───┐              │
│ │ - │  │  5  │  │ + │              │  ← Buttons + input
│ └───┘  └─────┘  └───┘              │
│ Select 1-10 tickets                 │
└─────────────────────────────────────┘
```

### For Full Tables:
```
┌─────────────────────────────────────┐
│ Table Purchase                      │
│ You are purchasing 1 table that     │
│ includes 10 seats                   │
└─────────────────────────────────────┘
```

---

## Integration with Order Summary

The Order Summary should update immediately when quantity changes:

**Before:**
```
VIP Ticket               $500
Quantity: 1
─────────────────────────────
Subtotal              $500.00
```

**After changing to 3:**
```
VIP Ticket               $500
Quantity: 3
─────────────────────────────
Subtotal            $1,500.00
```

**For tables (quantity locked at 1):**
```
VIP Table             $5,000
Table of 10 seats
─────────────────────────────
Total               $5,000.00
```

---

## Code Location

**Recommended placement in CheckoutSteps.tsx:**

```typescript
// In Step 1 (Buyer Info), after email/phone fields:

{/* Step 1: Buyer Information */}
<div className="space-y-4">
  {/* Name field */}
  <div>...</div>
  
  {/* Email field */}
  <div>...</div>
  
  {/* Phone field */}
  <div>...</div>
  
  {/* 👇 ADD QUANTITY SELECTOR HERE */}
  {productKind === "INDIVIDUAL_TICKET" && (
    <div className="space-y-2">
      <Label htmlFor="quantity">Number of Tickets</Label>
      <Input
        id="quantity"
        type="number"
        min={1}
        max={10}
        value={data.quantity}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10)
          if (value >= 1 && value <= 10) {
            setData({ ...data, quantity: value })
          }
        }}
        className="w-full"
      />
      <p className="text-sm text-muted-foreground">
        Select 1-10 tickets
      </p>
    </div>
  )}
  
  {productKind === "FULL_TABLE" && (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <p className="text-sm font-medium">Table Purchase</p>
      <p className="text-sm text-muted-foreground mt-1">
        You are purchasing 1 table that includes 10 seats
      </p>
    </div>
  )}
  
  {/* Continue button */}
  <Button onClick={handleNext}>Continue</Button>
</div>
```

---

## Summary

**Basic Implementation (Recommended):**
- Numeric input with min={1} max={10}
- Clean, simple, works well
- No extra dependencies

**Enhanced Implementation (Optional):**
- Numeric input + increment/decrement buttons
- Better UX, more visual
- Requires Button component and Lucide icons

**Choose based on:**
- **Basic**: Faster to implement, minimal UI
- **Enhanced**: Better UX, more polished, worth the extra 5 minutes

Both options are mobile-responsive and accessible with shadcn/ui components.

---

## Acceptance Criteria

- [ ] Individual tickets: Numeric input visible
- [ ] Full tables: Informational text (no input)
- [ ] Input accepts values 1-10 only
- [ ] Typing out-of-range values is handled gracefully
- [ ] Order Summary updates in real-time
- [ ] Mobile responsive (44×44px touch target)
- [ ] Accessible (keyboard, screen reader, ARIA)
- [ ] No console errors
- [ ] Matches shadcn/ui design system

---

**Status:** Ready for Implementation  
**Estimated Time:** 15-20 minutes (basic) or 30 minutes (enhanced)  
**Dependencies:** shadcn/ui Input, Label (and optionally Button)
