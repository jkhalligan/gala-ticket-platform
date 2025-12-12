# Table Setup Modal Flow - Testing Guide

## Changes Made

### 1. Fixed `tableSlug` Handling in SuccessScreen
**Issue:** The `tableSlug` was never being passed from `CheckoutSteps` to `SuccessScreen`, so the modal never appeared.

**Solution:** Modified `SuccessScreen` to rely on the `orderData.table_slug` from polling instead of requiring it as a prop.

**Files Changed:**
- `src/components/public/checkout/SuccessScreen.tsx` (lines 46-57, 60-131)

### 2. Added Comprehensive Error Handling for Polling
**Changes:**
- Added `pollingError` state to track polling failures
- Improved error messages for failed API calls
- Added timeout handling with user-friendly message
- Display polling errors in yellow warning box

**Files Changed:**
- `src/components/public/checkout/SuccessScreen.tsx` (lines 49, 80, 83-84, 110, 114-127, 278-282)

### 3. Enhanced Modal with Loading States
**Changes:**
- All form inputs disable during save operation
- Save button shows loading spinner and "Saving..." text
- Skip button disabled during save
- Form validation prevents submission during errors

**Files Changed:**
- `src/components/dashboard/TableSetupModal.tsx` (lines 130, 144, 170, 186, 191)

### 4. Added Client-Side Slug Validation
**Features:**
- Real-time format validation as user types
- Auto-formatting (lowercase, replace invalid chars with hyphens)
- Validation rules:
  - Minimum 3 characters
  - Maximum 50 characters
  - Only lowercase letters, numbers, and hyphens
  - Cannot start/end with hyphen
  - Cannot have consecutive hyphens
- Red border and error message for invalid slugs
- Save button disabled when slug is invalid

**Files Changed:**
- `src/components/dashboard/TableSetupModal.tsx` (lines 33-34, 36-66, 69-76, 138-156, 191)

### 5. Additional UX Improvements
- Character counter for welcome message (1000 max)
- Max length enforcement on all fields
- Better error message display

---

## Manual Testing Steps

### Prerequisites
1. Ensure dev server is running: `npm run dev`
2. Have Stripe test keys configured in `.env.local`
3. Database is seeded with active event and products

### Test 1: Complete Happy Path
**Goal:** Verify the entire flow works end-to-end

1. Navigate to: `http://localhost:3000/checkout?event=2025-gala&tier=VIP&type=table&mode=host`

2. Fill out checkout form:
   - Email: `test-table-owner@example.com`
   - First Name: `John`
   - Last Name: `Smith`
   - Phone: `555-1234`
   - Quantity: `10` (or default for VIP table)

3. In payment step, use Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`

4. Click "Complete Purchase"

5. **VERIFY SUCCESS SCREEN:**
   - ✅ Confetti animation plays
   - ✅ "Payment Successful!" header
   - ✅ Order details show correct tier/quantity
   - ✅ Loading spinner appears: "Setting up your table..."
   - ✅ Email confirmation message shows

6. **WAIT 2-3 SECONDS** (for polling + modal delay)

7. **VERIFY MODAL APPEARS:**
   - ✅ Modal title: "Customize Your Table"
   - ✅ Three input fields visible:
     - Table Name
     - Custom URL (optional)
     - Welcome Message (optional)
   - ✅ "Skip for Now" and "Save & Continue" buttons

8. **TEST FORM VALIDATION:**
   - In "Custom URL" field, type: `Ab`
   - ✅ Verify it auto-formats to lowercase: `ab`
   - ✅ Verify error message: "URL must be at least 3 characters"
   - ✅ Verify "Save & Continue" button is disabled

9. **COMPLETE FORM:**
   - Table Name: `Smith Family Table`
   - Custom URL: `smith-family-2025`
   - Welcome Message: `Welcome to our table! We're excited to celebrate with you.`
   - ✅ Verify character counter shows: `XX/1000 characters`
   - ✅ Verify preview URL updates: `/dashboard/table/smith-family-2025`
   - ✅ Verify no error messages
   - ✅ Verify "Save & Continue" button is enabled

10. **SUBMIT FORM:**
    - Click "Save & Continue"
    - ✅ Button shows loading spinner and "Saving..."
    - ✅ All inputs become disabled

11. **VERIFY REDIRECT:**
    - ✅ Redirects to `/dashboard/table/smith-family-2025?devAuth=test-table-owner@example.com`
    - ✅ Table dashboard loads successfully
    - ✅ Shows table name: "Smith Family Table"
    - ✅ Shows welcome message in card

12. **VERIFY DATABASE:**
    ```bash
    npx prisma studio
    ```
    - Open `Table` model
    - Find the newly created table
    - ✅ `slug` = `smith-family-2025`
    - ✅ `name` = `Smith Family Table`
    - ✅ `welcome_message` = `Welcome to our table! We're excited to celebrate with you.`
    - ✅ `type` = `PREPAID`
    - ✅ `status` = `ACTIVE`
    - ✅ `primary_owner_id` matches the created user

13. **VERIFY ACTIVITY LOG:**
    - Open `ActivityLog` model
    - Find entry with `action` = `TABLE_UPDATED`
    - ✅ `entity_type` = `TABLE`
    - ✅ `metadata` contains the changes

---

### Test 2: Skip Modal Flow
**Goal:** Verify "Skip for Now" works correctly

1. Repeat checkout flow from Test 1 (steps 1-7)

2. When modal appears, click **"Skip for Now"**

3. **VERIFY REDIRECT:**
   - ✅ Redirects to `/dashboard/table/{original-slug}?devAuth=...`
   - ✅ Table dashboard loads
   - ✅ Table has default name (e.g., "My Table" or based on order metadata)

---

### Test 3: Slug Validation Edge Cases
**Goal:** Test all validation rules

1. Start checkout flow and wait for modal to appear

2. **Test: Too Short**
   - Type: `ab`
   - ✅ Error: "URL must be at least 3 characters"
   - ✅ Save button disabled

3. **Test: Invalid Characters**
   - Type: `My Table!`
   - ✅ Auto-formats to: `my-table-`
   - ✅ Error: "URL cannot start or end with a hyphen"

4. **Test: Consecutive Hyphens**
   - Type: `smith--family`
   - ✅ Auto-formats to: `smith-family` (removes double hyphen)

5. **Test: Starting with Hyphen**
   - Type: `-smith`
   - ✅ Error: "URL cannot start or end with a hyphen"

6. **Test: Too Long**
   - Type: `this-is-a-very-long-url-slug-that-exceeds-fifty-characters-limit-123456789`
   - ✅ Error: "URL must be less than 50 characters"

7. **Test: Valid Slug**
   - Type: `valid-slug-123`
   - ✅ No errors
   - ✅ Save button enabled
   - ✅ Preview shows: `/dashboard/table/valid-slug-123`

---

### Test 4: Duplicate Slug Handling
**Goal:** Test server-side slug uniqueness validation

1. Complete a table purchase with slug: `test-slug`

2. Start a second table purchase (new checkout session)

3. In modal, try to use the same slug: `test-slug`

4. Click "Save & Continue"

5. **VERIFY ERROR:**
   - ✅ API returns 400 error
   - ✅ Modal shows error message: "This URL is already taken. Please choose a different one."
   - ✅ Form stays open (doesn't redirect)
   - ✅ User can try a different slug

---

### Test 5: Polling Error Handling
**Goal:** Test behavior when webhook is delayed/fails

**Setup:** Temporarily disable the Stripe webhook or use invalid webhook secret

1. Complete checkout flow

2. **VERIFY POLLING BEHAVIOR:**
   - ✅ Loading spinner appears
   - ✅ Polls for ~20 seconds (20 attempts × 1 second)
   - ✅ After timeout, shows yellow warning box:
     > "Order processing is taking longer than expected. Your payment was successful, but the order details may take a moment to appear. Please check your dashboard or refresh the page."
   - ✅ Modal does NOT appear (since `tableSlug` is still null)
   - ✅ Countdown continues and redirects to `/dashboard`

---

### Test 6: Browser DevTools Inspection
**Goal:** Verify no console errors or warnings

1. Open browser DevTools (F12) → Console tab

2. Complete full checkout flow

3. **VERIFY CLEAN CONSOLE:**
   - ✅ No red errors (except expected CORS/fonts)
   - ✅ No unhandled promise rejections
   - ✅ Polling logs show successful fetches

4. **CHECK NETWORK TAB:**
   - ✅ `/api/orders/by-payment-intent/{id}` returns 200 OK
   - ✅ Response includes `table_slug`
   - ✅ `PATCH /api/tables/{slug}` returns 200 OK
   - ✅ Response includes `new_slug`

---

## Expected Behavior Summary

### When Modal Should Appear
✅ **YES** - After successful table purchase when:
- `loading === false` (polling complete)
- `isFullTable === true` (product kind is FULL_TABLE)
- `tableSlug !== null` (webhook created table and polling retrieved slug)

❌ **NO** - Modal will NOT appear when:
- Polling is still in progress
- Polling failed/timed out
- Purchase was for individual tickets (not table)
- `tableSlug` is null/undefined

### Modal Behavior
- **Cannot be dismissed** by clicking outside (intentional to encourage engagement)
- **Validates slug** in real-time with instant feedback
- **Disables inputs** during save operation
- **Shows errors** inline with red styling
- **Character limit** enforced on welcome message (1000 chars)
- **Preview URL** updates as slug is typed

### Error Scenarios Handled
1. **Polling timeout** → Yellow warning, redirect to dashboard
2. **Invalid slug format** → Red error, save disabled
3. **Duplicate slug** → Server error shown in modal
4. **Network errors** → Logged to console, graceful fallback

---

## Rollback Instructions

If issues are found, revert with:
```bash
git checkout HEAD -- src/components/public/checkout/SuccessScreen.tsx
git checkout HEAD -- src/components/dashboard/TableSetupModal.tsx
npm run build
```

---

## Notes for Production

- ✅ `devAuth` parameter is KEPT (as requested)
- ⚠️ Before production, test with real Stripe webhooks
- ⚠️ Consider adding Sentry/error tracking for polling failures
- ⚠️ May want to add analytics events (modal shown, skipped, submitted)

---

**Last Updated:** December 11, 2025
**Changes Implemented By:** Claude Code
**Status:** Ready for Testing ✅
