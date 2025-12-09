stu# Phase 6 - User Dashboard: Remaining Scope

**Status:** Partial Implementation Complete
**Date:** December 8, 2024
**Branch:** `phase-6/user-dashboard`
**Completed Commit:** `d198f1c`

## Summary

Phase 6 implemented a foundational user dashboard with server-side data fetching and basic inline editing for guest details. This document outlines the remaining features that were scoped but not implemented due to time/token constraints.

## What Was Completed ✅

### API Endpoints
- ✅ `GET /api/users/me/dashboard` - Comprehensive dashboard data with permissions
- ✅ Verified all existing endpoints: `PATCH /api/tables/[slug]`, `PATCH /api/guests/[id]`, `POST /api/tables/[slug]/guests`, `DELETE /api/guests/[id]`

### Components
- ✅ `DashboardClient.tsx` - Client component with tables and tickets display
- ✅ `EditGuestDialog.tsx` - Dialog for editing guest name and dietary restrictions
- ✅ Enhanced dashboard page with shadcn/ui Card components
- ✅ Toast notifications using sonner
- ✅ Stats cards showing table count, ticket count, admin status

### Features
- ✅ View all tables with role badges (OWNER, CAPTAIN, etc.)
- ✅ View all guest assignments/tickets with check-in status
- ✅ Edit guest details (name, dietary restrictions)
- ✅ Admin quick links to table management
- ✅ Server-side data fetching with client-side interactivity (hybrid approach)

---

## Remaining Scope for Future Sprint

### 1. Table Management Actions

#### 1.1 Inline Table Name Editing
**Priority:** Medium
**Complexity:** Low
**API Endpoint:** `PATCH /api/tables/[slug]` (exists)

**Requirements:**
- Table name shows with subtle edit icon on hover
- Click name → Input field appears inline
- Show save (✓) and cancel (✕) icons
- Enter to save, Escape to cancel
- Optimistic update with revert on error
- Success toast notification

**Implementation Notes:**
```typescript
// Add to DashboardClient.tsx
const [editingTableId, setEditingTableId] = useState<string | null>(null);
const [editedTableName, setEditedTableName] = useState("");

async function handleSaveTableName(tableId: string, slug: string) {
  const response = await fetch(`/api/tables/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: editedTableName }),
  });
  // Handle response, show toast, refresh
}
```

#### 1.2 Add Guests to Table
**Priority:** High
**Complexity:** Medium
**API Endpoint:** `POST /api/tables/[slug]/guests` (exists)

**Requirements:**
- "Invite Guests" button on each table card
- Opens dialog with form:
  - Input: Email (required)
  - Input: Name (optional)
  - [Cancel] [Send Invite]
- Behavior depends on table type:
  - **PREPAID:** Creates guest immediately, sends email
  - **CAPTAIN_PAYG:** Creates guest with pending status, sends payment link
- Updates guest count in card
- Shows success toast

**Component to Create:**
```typescript
// src/components/dashboard/InviteGuestDialog.tsx
interface InviteGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  tableSlug: string;
  tableName: string;
  tableType: "PREPAID" | "CAPTAIN_PAYG";
  onSuccess?: () => void;
}
```

**API Call:**
```typescript
POST /api/tables/:slug/guests
Body: {
  email: string,
  first_name?: string,
  last_name?: string,
  order_id: string // Must specify which order's placeholder seat to claim
}
```

**Note:** Current API requires `order_id` - may need to adjust for direct invites or create placeholder orders first.

#### 1.3 Remove Guests from Table
**Priority:** Medium
**Complexity:** Medium
**API Endpoint:** `DELETE /api/tables/[slug]/guests/[guestId]` (exists)

**Requirements:**
- [Remove] button next to guest name in table card
- Only shows if user has permission (check table role)
- Opens confirmation AlertDialog:
  - "Remove [Guest Name] from table?"
  - "This action cannot be undone."
  - [Cancel] [Remove Guest]
- Validates CAPTAIN_PAYG rules (can't remove guests who paid)
- Removes guest from list immediately
- Shows success toast

**Permission Checks Needed:**
- Use `checkTablePermission(userId, tableId, 'remove_guest')` from `/lib/permissions.ts`
- For CAPTAIN_PAYG: Use `checkRemoveGuestPermission(userId, guestAssignmentId)`

**Component to Create:**
```typescript
// src/components/dashboard/RemoveGuestDialog.tsx
interface RemoveGuestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  guestName: string;
  tableSlug: string;
  onSuccess?: () => void;
}
```

#### 1.4 Share Table Link
**Priority:** Low
**Complexity:** Low
**API Endpoint:** None (client-side only)

**Requirements:**
- "Share Table Link" button on table card
- Copies table URL to clipboard: `https://[domain]/tables/[slug]`
- Shows toast: "Table link copied to clipboard"
- Link allows people to view table and request to join

**Implementation:**
```typescript
async function handleShareTable(slug: string) {
  const url = `${window.location.origin}/tables/${slug}`;
  await navigator.clipboard.writeText(url);
  toast.success("Table link copied to clipboard");
}
```

---

### 2. Guest Management Actions

#### 2.1 Leave Table Functionality
**Priority:** Medium
**Complexity:** Low
**API Endpoint:** `DELETE /api/guests/[id]/leave` (exists) OR `DELETE /api/guests/[id]`

**Requirements:**
- "Leave Table" button on guest ticket card
- Only shows if `can_leave` is true (based on payment status)
- Opens confirmation AlertDialog:
  - "Leave [Table Name]?"
  - "You'll need to contact the host to rejoin this table."
  - [Cancel] [Leave Table]
- Removes card from dashboard
- Shows success toast

**Permission Logic:**
- Can leave if not paid (for CAPTAIN_PAYG guests)
- Can leave if table owner allows (configurable)
- Cannot leave if ticket was paid for

**Component to Create:**
```typescript
// src/components/dashboard/LeaveTableDialog.tsx
interface LeaveTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  tableName: string;
  onSuccess?: () => void;
}
```

#### 2.2 Enhanced Guest Editing
**Priority:** Low
**Complexity:** Low
**Current:** `EditGuestDialog.tsx` exists but incomplete

**Requirements to Add:**
- Phone number field (optional)
- Better validation and error messages
- Support for editing auction registration status (if admin)
- Support for editing bidder number (if admin)

**Update Needed:**
```typescript
// Add to EditGuestDialog.tsx
const [phone, setPhone] = useState(guestPhone || "");

// In API call body:
body: JSON.stringify({
  display_name: name,
  dietary_restrictions: dietary || null,
  phone: phone || null, // Add this
})
```

---

### 3. Additional Dashboard Cards

#### 3.1 EventInfoCard
**Priority:** Medium
**Complexity:** Low
**Data Source:** Already available in `formattedAssignments[].event`

**Requirements:**
- Shows for each upcoming event user is attending
- Displays:
  - Event name and date
  - Venue name and address (if available)
  - Dress code (if available)
  - Event description
  - Countdown timer (days until event)
- Styled as Card component

**Component to Create:**
```typescript
// src/components/dashboard/EventInfoCard.tsx
interface EventInfoCardProps {
  eventName: string;
  eventDate: Date | string;
  venueName?: string;
  venueAddress?: string;
  dressCode?: string;
  description?: string;
}
```

**Data Enhancement Needed:**
- Update `/api/users/me/dashboard` to include full event details
- Add dress_code, description, venue_address to Event schema (if not exists)

#### 3.2 QuickActionsCard
**Priority:** Low
**Complexity:** Medium

**Requirements:**
- Quick action buttons:
  - View QR Code (for check-in)
  - Download Ticket PDF
  - Add to Calendar
  - Contact Event Organizer
- Links open in dialogs or new windows
- Conditional display based on what's available

**Component to Create:**
```typescript
// src/components/dashboard/QuickActionsCard.tsx
interface QuickActionsCardProps {
  guestId?: string; // For QR code generation
  eventId?: string;
  hasTicket: boolean;
  eventDate?: Date | string;
}
```

**New Features Required:**
- QR code generation endpoint
- PDF ticket generation endpoint
- Calendar export (.ics file generation)

#### 3.3 PaymentSummaryCard
**Priority:** Medium
**Complexity:** Low
**Data Source:** Already available from `/api/users/me/dashboard` → `recent_orders`

**Requirements:**
- Shows last 2-3 completed orders
- Each order displays:
  - Order number/ID
  - Date
  - Amount (formatted: $X.XX)
  - Items purchased (product name)
  - Status badge
- "View All Orders" link to `/dashboard/orders` (new page)

**Component to Create:**
```typescript
// src/components/dashboard/PaymentSummaryCard.tsx
interface PaymentSummaryCardProps {
  orders: Array<{
    id: string;
    amount_cents: number;
    created_at: Date | string;
    product_name: string;
    product_kind: string;
  }>;
}
```

**Implementation:**
```tsx
// Already have data in DashboardClient, just need to pass it:
// From /api/users/me/dashboard response:
{
  recent_orders: [
    {
      id: "order_123",
      amount_cents: 15000, // $150.00
      created_at: "2024-12-01",
      product_name: "VIP Table - Table 5",
      product_kind: "FULL_TABLE"
    }
  ]
}
```

#### 3.4 EmptyStateCard Enhancements
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Better visual design for empty states
- Illustrations or icons
- Call-to-action buttons:
  - "Browse Events" (if no tickets)
  - "Create a Table" (if admin and no tables)
  - "Contact Us" (if need help)
- Helpful messaging explaining next steps

---

### 4. Advanced Permissions Integration

#### 4.1 Permission-Based UI Hiding
**Priority:** High
**Complexity:** Medium
**Dependencies:** `/lib/permissions.ts` functions

**Current State:**
- Basic permission structure exists in `/api/users/me/dashboard`
- Permissions calculated but not fully enforced in UI

**Requirements:**
- Use `permissions.can_edit`, `can_add_guests`, `can_remove_guests` from API response
- Hide/show buttons based on permissions:
  - "Invite Guests" only if `can_add_guests === true`
  - "Remove Guest" only if `can_remove_guests === true`
  - "Edit Table Name" only if `can_edit === true`
- Show permission explanations in tooltips
- Gracefully handle permission errors from API

**Implementation:**
```typescript
// In DashboardClient.tsx
{table.permissions.can_add_guests && (
  <Button onClick={() => setInviteDialogOpen(true)}>
    Invite Guests
  </Button>
)}

{table.permissions.can_edit && (
  <Button variant="ghost" size="sm">
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

#### 4.2 Table-Type-Specific Rules
**Priority:** High
**Complexity:** Medium

**PREPAID Tables:**
- Host pays for all seats upfront
- Host can add/remove any guest
- Guests cannot leave (seat is paid for)

**CAPTAIN_PAYG Tables:**
- Captain recruits guests who pay individually
- Captain can add guests (who then pay themselves)
- Captain CANNOT remove guests who have paid
- Guests CAN leave if they haven't paid yet

**Implementation:**
- Add `tableType` to table data passed to components
- Conditional rendering based on type
- Different confirmation messages for each type
- Show payment status in guest list for CAPTAIN_PAYG

#### 4.3 Dynamic `can_leave` Logic
**Priority:** Medium
**Complexity:** Medium

**Current State:**
- `can_leave: true` hardcoded in `/api/users/me/dashboard`

**Correct Logic:**
```typescript
// In /api/users/me/dashboard/route.ts
const formattedAssignments = await Promise.all(
  guestAssignments.map(async (assignment) => {
    // Check if guest has a completed order (they paid)
    const hasPaid = await prisma.order.findFirst({
      where: {
        user_id: user.id,
        status: 'COMPLETED',
        // Link to this guest assignment somehow
      },
    });

    return {
      id: assignment.id,
      // ... other fields
      can_leave: !hasPaid, // Can only leave if they haven't paid
    };
  })
);
```

**Note:** May need to enhance Order → GuestAssignment relationship in schema.

---

### 5. UI Polish & Enhancements

#### 5.1 Loading States
**Priority:** Medium
**Complexity:** Low

**Requirements:**
- Skeleton loaders during initial data fetch
- Skeleton cards match real card structure
- Loading spinners on buttons during save operations
- Disable buttons during API calls

**Components to Use:**
- shadcn/ui `<Skeleton />` component (already exists)

**Implementation:**
```tsx
// In DashboardClient.tsx
{isLoading ? (
  <div className="grid gap-4">
    {[1, 2, 3].map((i) => (
      <Card key={i}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
) : (
  // Actual content
)}
```

#### 5.2 Enhanced Empty States
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Illustrations or icons for empty states
- Better messaging with personality
- Call-to-action buttons
- Different messages for different empty states:
  - No tables yet
  - No tickets yet
  - No upcoming events

**Example:**
```tsx
<Card>
  <CardContent className="p-12 text-center">
    <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
    <p className="text-muted-foreground mb-4">
      You don't have any event tickets yet.
    </p>
    <Button asChild>
      <Link href="/events">Browse Events</Link>
    </Button>
  </CardContent>
</Card>
```

#### 5.3 Capacity Progress Bars
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Visual progress bars for table occupancy
- Color-coded: Green (0-70%), Yellow (70-99%), Red (100%+)
- Shows filled/total seats
- Tooltip with percentage on hover

**Component to Use:**
- shadcn/ui `<Progress />` component (already exists)

**Implementation:**
```tsx
// In table card
const percentFilled = (table.filled_seats / table.capacity) * 100;
const progressColor = percentFilled >= 100 ? "bg-red-500" :
                      percentFilled >= 70 ? "bg-yellow-500" :
                      "bg-green-500";

<div className="space-y-1">
  <div className="flex justify-between text-xs">
    <span>{table.filled_seats} / {table.capacity} seats</span>
    <span>{Math.round(percentFilled)}%</span>
  </div>
  <Progress
    value={Math.min(percentFilled, 100)}
    className="h-2"
    indicatorClassName={progressColor}
  />
</div>
```

#### 5.4 Mobile Optimization
**Priority:** Medium
**Complexity:** Medium

**Requirements:**
- Touch-friendly button sizes (min 44x44px)
- Responsive card layouts (stack on mobile)
- No hover-only interactions
- Full-screen dialogs on mobile
- Swipe gestures not required
- Appropriate input types (email, tel)

**CSS Updates:**
```tsx
// Button minimum sizes
<Button className="min-h-[44px] min-w-[44px]">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Mobile-friendly dialog
<DialogContent className="sm:max-w-md max-w-full h-full sm:h-auto">
```

#### 5.5 Confirmation Dialogs
**Priority:** High
**Complexity:** Low

**Requirements:**
- Use AlertDialog for all destructive actions
- Clear, concise copy explaining consequences
- Destructive button styled in red
- Non-destructive default action (Cancel)

**Already Exists:**
- shadcn/ui `<AlertDialog />` component installed

**Needed For:**
- Remove guest
- Leave table
- (Future) Delete table

---

### 6. Enhanced Data Display

#### 6.1 Guest List in Table Cards
**Priority:** Medium
**Complexity:** Medium

**Requirements:**
- Show first 3-5 guests in table card
- Display guest name and tier badge
- "See all X guests" button to expand/view more
- Quick actions per guest (edit, remove)

**Data Source:**
- Already available in `/api/users/me/dashboard` response
- `tables[].guests` array includes guest info

**Implementation:**
```tsx
// In table card
<div className="mt-4 border-t pt-4">
  <h4 className="text-sm font-medium mb-2">Guests</h4>
  <div className="space-y-2">
    {table.guests.slice(0, 5).map((guest) => (
      <div key={guest.id} className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>{guest.name}</span>
          <Badge variant="outline" size="sm">{guest.tier}</Badge>
        </div>
        {table.permissions.can_remove_guests && (
          <Button variant="ghost" size="sm">Remove</Button>
        )}
      </div>
    ))}
    {table.guests.length > 5 && (
      <Button variant="link" size="sm">
        See all {table.guests.length} guests
      </Button>
    )}
  </div>
</div>
```

#### 6.2 Tier Badges
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Visual badges for STANDARD/VIP/VVIP
- Color-coded: Gray (STANDARD), Blue (VIP), Purple (VVIP)
- Consistent across all displays

**Helper Function:**
```typescript
function getTierBadgeVariant(tier: string) {
  switch (tier) {
    case "VVIP": return "default"; // Purple
    case "VIP": return "secondary"; // Blue
    default: return "outline"; // Gray
  }
}

<Badge variant={getTierBadgeVariant(guest.tier)}>
  {guest.tier}
</Badge>
```

#### 6.3 Enhanced Check-In Status
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Better visual feedback for checked-in status
- Show check-in time (not just boolean)
- Green checkmark icon for checked in
- Gray clock icon for not checked in

**Implementation:**
```tsx
{guest.checked_in ? (
  <div className="flex items-center gap-2 text-green-600">
    <CheckCircle className="h-4 w-4" />
    <span className="text-sm">Checked in</span>
  </div>
) : (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Clock className="h-4 w-4" />
    <span className="text-sm">Not checked in</span>
  </div>
)}
```

#### 6.4 Dietary Restrictions Display
**Priority:** Low
**Complexity:** Low

**Requirements:**
- Show dietary restrictions in ticket card without needing to edit
- Support for multiple restrictions (JSON array)
- Badges for each restriction

**Current State:**
- Only shows when editing
- Stored as JSON in database

**Implementation:**
```tsx
{guest.dietary_restrictions && (
  <div className="text-sm">
    <span className="text-muted-foreground">Dietary: </span>
    <div className="flex flex-wrap gap-1 mt-1">
      {JSON.parse(guest.dietary_restrictions).map((restriction, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {restriction}
        </Badge>
      ))}
    </div>
  </div>
)}
```

---

## Technical Debt & Improvements

### Architecture
- [ ] Consider moving to React Query for better data fetching/caching
- [ ] Add optimistic updates for all mutations
- [ ] Implement proper error boundaries
- [ ] Add retry logic for failed API calls

### Performance
- [ ] Lazy load dialogs (dynamic imports)
- [ ] Memoize expensive computations
- [ ] Add pagination for large guest/table lists
- [ ] Optimize re-renders with React.memo

### Accessibility
- [ ] Add ARIA labels to all icon-only buttons
- [ ] Ensure keyboard navigation works for all interactions
- [ ] Add focus management for dialogs
- [ ] Screen reader announcements for dynamic updates
- [ ] Proper heading hierarchy (h1, h2, h3)

### Testing
- [ ] Add unit tests for components
- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests for critical user flows
- [ ] Test with real data at scale

---

## Implementation Priority Order

Based on user value and complexity:

### Sprint 1 (High Priority)
1. Permission-based UI hiding (Section 4.1)
2. Add guests to table (Section 1.2)
3. PaymentSummaryCard (Section 3.3)
4. Loading states (Section 5.1)
5. Confirmation dialogs (Section 5.5)

### Sprint 2 (Medium Priority)
6. Remove guests from table (Section 1.3)
7. Leave table functionality (Section 2.1)
8. EventInfoCard (Section 3.1)
9. Table-type-specific rules (Section 4.2)
10. Guest list in table cards (Section 6.1)

### Sprint 3 (Polish & Nice-to-Have)
11. Inline table name editing (Section 1.1)
12. Mobile optimization (Section 5.4)
13. Capacity progress bars (Section 5.3)
14. Enhanced empty states (Section 5.2)
15. Share table link (Section 1.4)

### Future Enhancements
16. QuickActionsCard (Section 3.2)
17. Enhanced guest editing with phone (Section 2.2)
18. Tier badges (Section 6.2)
19. Enhanced check-in status (Section 6.3)
20. Dietary restrictions display (Section 6.4)

---

## Files to Create

```
src/components/dashboard/
├── InviteGuestDialog.tsx          (Section 1.2)
├── RemoveGuestDialog.tsx          (Section 1.3)
├── LeaveTableDialog.tsx           (Section 2.1)
├── EventInfoCard.tsx              (Section 3.1)
├── QuickActionsCard.tsx           (Section 3.2)
├── PaymentSummaryCard.tsx         (Section 3.3)
└── EmptyStateCard.tsx             (Section 5.2)
```

## API Routes to Create/Enhance

```
src/app/api/
├── guests/[id]/leave/route.ts     (Optional: DELETE for leaving)
├── qr-codes/[guestId]/route.ts    (Generate QR code)
└── tickets/[guestId]/pdf/route.ts (Generate PDF ticket)
```

## Database Schema Changes Needed

None required for basic functionality. Optional enhancements:

```prisma
model Event {
  // Optional additions
  dress_code        String?
  venue_address     String?
  description       String?
}

model Order {
  // Consider adding explicit relationship to GuestAssignment
  guest_assignment_id String?
  guest_assignment    GuestAssignment? @relation(fields: [guest_assignment_id])
}
```

---

## Estimated Effort

**Total Remaining Work:** ~40-60 hours

- **Sprint 1 (High Priority):** ~15-20 hours
- **Sprint 2 (Medium Priority):** ~15-20 hours
- **Sprint 3 (Polish):** ~10-15 hours
- **Future Enhancements:** ~10-15 hours

**Complexity Breakdown:**
- Low Complexity: ~25 hours (UI polish, simple components)
- Medium Complexity: ~25 hours (Dialogs with API integration)
- High Complexity: ~10 hours (Permissions, table-type rules)

---

## Success Criteria

Dashboard will be considered "complete" when:

1. ✅ Users can view all their tables and tickets
2. ✅ Users can edit their own guest details
3. ⏳ Table owners can add guests to their tables
4. ⏳ Table owners can remove guests (with proper permissions)
5. ⏳ All actions respect table-type-specific rules
6. ⏳ UI gracefully handles loading and error states
7. ⏳ Mobile experience is fully functional
8. ⏳ All destructive actions require confirmation

---

## Notes for Future Developers

- **API Endpoints:** All CRUD endpoints already exist. Focus on UI/UX.
- **Permissions:** Use functions from `/lib/permissions.ts` - don't reinvent.
- **Styling:** Use shadcn/ui components exclusively for consistency.
- **Server vs Client:** Keep data fetching server-side, interactions client-side.
- **Toast Pattern:** Use `toast()` from sonner for all success/error feedback.
- **Dialog Pattern:** Follow `EditGuestDialog.tsx` as the template.

---

**Last Updated:** December 8, 2024
**Maintained By:** Development Team
**Related Docs:**
- [Phase 6 Completion Report](./PHASE-6-TABLE-ASSIGNMENTS-COMPLETION.md) (when created)
- [Tech Stack Versions](../docs/TECH-STACK-VERSIONS.md)
- [Architecture Overview](../docs/README-architecture.md)
