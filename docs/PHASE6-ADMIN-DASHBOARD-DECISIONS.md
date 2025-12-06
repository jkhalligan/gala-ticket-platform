# Phase 6 — Admin Dashboard: Planning & Design Decisions

**Date:** December 6, 2024  
**Status:** Planning Complete, Ready to Build

---

## Phase Reordering Decision

### Original Phase Order
- Phase 5: Sheets Sync Engine ✅
- Phase 6: Frontend Integration (React prototype migration)
- Phase 7: Admin Dashboard

### Revised Phase Order
- Phase 5: Sheets Sync Engine ✅
- **Phase 6: Admin Dashboard** ← Building this next
- **Phase 7: Frontend Integration** ← Moved later

### Rationale for Reordering

1. **Simpler Scope**: Admin dashboard is straightforward CRUD on existing APIs, while frontend integration requires complex React prototype refactoring
2. **No Technical Dependencies**: Both phases depend only on Phases 2-4, so either can come next
3. **Operational Tools Immediately**: Provides admin tools to manage data and test scenarios while working on Phase 7
4. **Backend Testing**: Exercises all backend APIs with real UI before tackling complex frontend migration
5. **No Migration Complexity**: New Next.js App Router pages from scratch vs. migrating existing React code
6. **Faster Time to Value**: Phase 6 estimated at 1-2 weeks vs Phase 7's 2-3 weeks
7. **Earlier Usability**: Event staff can start using admin tools immediately

---

## UI/UX Technology Stack

### Core Framework
- **Next.js 16** with App Router
- **React 19** (Server Components by default)
- **TypeScript** throughout
- **Tailwind CSS** (already configured)

### Component Library
**shadcn/ui** — Copy-paste component library

**Why shadcn/ui:**
- Not a dependency (you own the code)
- Built on Radix UI (accessible primitives)
- Tailwind-native
- Production-ready (used by Vercel, Linear, Cal.com)
- Highly customizable

**Components to Install:**
```bash
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add badge
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add dropdown-menu
npx shadcn@latest add tabs
npx shadcn@latest add command
```

### Reference Examples
- Official: https://ui.shadcn.com/examples/dashboard
- Live Demo: https://shadcn-admin.netlify.app/

---

## Design System Decisions

### Color Scheme: **Neutral Multi-Tenant Theme**

**Decision:** Keep admin dashboard completely neutral with NO brand colors

**Rationale:**
- Platform is multi-tenant (will serve multiple organizations)
- Will be used for future events beyond Pink Gala
- Professional, data-focused aesthetic
- Brand colors reserved for public-facing interfaces (Phase 7)

**Color Palette:**
```css
:root {
  /* Neutral grays - professional admin theme */
  --background: 0 0% 100%;           /* White */
  --foreground: 222 47% 11%;         /* Dark gray/charcoal */
  --muted: 210 40% 96.1%;            /* Light gray backgrounds */
  --muted-foreground: 215.4 16.3% 46.9%;
  
  /* Primary actions - neutral dark */
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  
  /* Borders and inputs */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222 47% 11%;
  
  /* Destructive actions */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  
  /* Success/positive */
  --success: 142 71% 45%;
  --success-foreground: 210 40% 98%;
}
```

**Usage Guidelines:**
- Status badges: Use semantic colors (success green, destructive red, muted gray)
- Table types: Neutral badge variants (default, secondary, outline)
- CTAs: Primary button (dark charcoal)
- Data emphasis: Text hierarchy only (font weight, size)

### Typography: **Geist Font**

**Font Stack:**
```typescript
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

// Applied in layout
className={`${GeistSans.variable} ${GeistMono.variable}`}
```

**Rationale:**
- Modern, clean, professional
- Excellent readability at all sizes
- Used by Vercel (signals quality)
- Similar to Inter but slightly more refined
- Built-in mono variant for technical data (IDs, reference codes)

**Font Usage:**
- **Sans (default)**: All UI text, tables, forms, labels
- **Mono**: Reference codes (25-T001, G0001), order IDs, technical identifiers

### Responsive Design
- **Mobile-first approach**
- Sidebar collapses to hamburger on mobile
- Tables scroll horizontally on small screens
- Forms stack vertically on mobile
- Tested at: 320px, 768px, 1024px, 1920px breakpoints

### Accessibility
- All shadcn/ui components are WCAG 2.1 AA compliant
- Keyboard navigation throughout
- Screen reader tested
- Focus indicators visible
- Color contrast ratios meet standards
- ARIA labels on interactive elements

---

## Admin Dashboard Pages & Features

### Phase 6 Deliverables

#### 1. Authentication & Layout
- [ ] Admin role check middleware
- [ ] Sidebar navigation
- [ ] Header with user menu
- [ ] Breadcrumbs
- [ ] Global search command palette (⌘K)

#### 2. Tables Management (`/admin/tables`)
- [ ] List all tables with search/filter
- [ ] Columns: Name, Type, Owner, Capacity, Filled, Status
- [ ] Sort by any column
- [ ] Filter by: Type (PREPAID, CAPTAIN_PAYG), Status (Full, Available), Event
- [ ] Actions: View, Edit, Delete
- [ ] Create new table modal
  - [ ] Regular table (linked to product)
  - [ ] Comp table (custom $0 pricing)
  - [ ] Sponsor table (custom pricing)
- [ ] Bulk actions: Export to CSV

#### 3. Guests Management (`/admin/guests`)
- [ ] List all guests with search/filter
- [ ] Columns: Name, Email, Table, Ticket Tier, Payment Status, Reference Code
- [ ] Sort by any column
- [ ] Filter by: Table, Tier, Payment Status, Event
- [ ] Actions: View, Edit, Transfer, Remove
- [ ] Manually assign guest to table
- [ ] Reassign guest between tables
- [ ] Mark as checked in (future)
- [ ] Export to CSV

#### 4. Orders Management (`/admin/orders`)
- [ ] List all orders with search/filter
- [ ] Columns: Order ID, Buyer, Amount, Status, Payment Method, Created Date
- [ ] Sort by any column
- [ ] Filter by: Status, Payment Method, Date Range, Event
- [ ] Actions: View details, Refund (Stripe)
- [ ] Mark offline payment received
- [ ] View payment timeline
- [ ] Export to CSV

#### 5. Ticket Invitations (`/admin/invitations`)
- [ ] Create ticket invitation
  - [ ] Select guest email
  - [ ] Select product/tier
  - [ ] Set custom price (optional)
  - [ ] Generate payment link
- [ ] List all invitations
- [ ] Columns: Email, Product, Price, Status, Link, Created Date
- [ ] Actions: Copy link, Resend, Cancel
- [ ] Track invitation status (Sent, Clicked, Paid)

#### 6. Google Sheets Sync (`/admin/sync`)
- [ ] Manual sync trigger button
- [ ] Sync mode selection: Export only, Import only, Bidirectional
- [ ] Last sync timestamp
- [ ] Sync status indicator
- [ ] Sync log/history
- [ ] Error reporting

#### 7. Activity Log (`/admin/activity`)
- [ ] List all activity events
- [ ] Columns: Timestamp, User, Action, Entity, Details
- [ ] Filter by: User, Action Type, Entity Type, Date Range
- [ ] Search by entity ID or details
- [ ] Export to CSV

#### 8. Waitlist Management (`/admin/waitlist`)
- [ ] List waitlisted users
- [ ] Columns: Email, Product Interest, Joined Date, Status
- [ ] Actions: Convert to invitation, Remove
- [ ] Bulk convert to invitations

#### 9. Dashboard Overview (`/admin`)
- [ ] Key metrics cards:
  - [ ] Total tables (with breakdown by type)
  - [ ] Total guests (with breakdown by tier)
  - [ ] Total revenue
  - [ ] Tickets sold vs. capacity
- [ ] Recent activity feed
- [ ] Upcoming tasks/alerts
- [ ] Quick actions

---

## File Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx              # Admin shell (sidebar, header)
│   │   ├── page.tsx                # Dashboard overview
│   │   ├── tables/
│   │   │   ├── page.tsx            # Tables list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Table detail/edit
│   │   ├── guests/
│   │   │   ├── page.tsx            # Guests list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Guest detail/edit
│   │   ├── orders/
│   │   │   ├── page.tsx            # Orders list
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Order detail
│   │   ├── invitations/
│   │   │   └── page.tsx            # Invitations management
│   │   ├── sync/
│   │   │   └── page.tsx            # Sheets sync controls
│   │   ├── activity/
│   │   │   └── page.tsx            # Activity log
│   │   └── waitlist/
│   │       └── page.tsx            # Waitlist management
│   └── api/
│       └── admin/
│           ├── tables/route.ts
│           ├── guests/route.ts
│           ├── orders/route.ts
│           ├── invitations/route.ts
│           ├── sync/route.ts
│           └── activity/route.ts
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── admin/                       # Admin-specific components
│       ├── sidebar.tsx
│       ├── header.tsx
│       ├── data-table.tsx           # Reusable table with sort/filter
│       ├── create-table-dialog.tsx
│       ├── assign-guest-dialog.tsx
│       └── ...
├── lib/
│   ├── admin/
│   │   ├── tables.ts                # Server actions for tables
│   │   ├── guests.ts                # Server actions for guests
│   │   └── orders.ts                # Server actions for orders
│   └── ...
└── types/
    └── admin.ts                     # Admin-specific TypeScript types
```

---

## Development Approach

### No Prototype Required

**Decision:** Build directly using shadcn/ui best practices

**Rationale:**
1. Admin CRUD interfaces follow well-established conventions
2. shadcn/ui provides battle-tested UX patterns
3. APIs are already built and documented
4. Easy to iterate and adjust as we build
5. Reference examples clearly show the target aesthetic

### Implementation Strategy

**1. Setup Phase** (Day 1)
- Install shadcn/ui
- Configure Geist font
- Set up neutral theme variables
- Create admin layout shell

**2. Core Components** (Days 2-3)
- Build reusable data table component
- Create common dialogs/modals
- Set up command palette (search)
- Build sidebar navigation

**3. Page Implementation** (Days 4-8)
- Tables page (list, create, edit)
- Guests page (list, assign, transfer)
- Orders page (list, view, refund)
- Dashboard overview
- Remaining pages

**4. Polish** (Days 9-10)
- Loading states (Suspense)
- Error boundaries
- Empty states
- Mobile responsiveness
- Accessibility audit

### Server Components Strategy

**Use Server Components for:**
- Data fetching (all list pages)
- Initial page loads
- Dashboard metrics

**Use Client Components for:**
- Forms and inputs
- Dialogs/modals
- Interactive tables (sorting, filtering)
- Command palette
- Any component with useState/useEffect

### API Patterns

**Server Actions for Mutations:**
```typescript
// lib/admin/tables.ts
'use server'

export async function createTable(data: CreateTableInput) {
  const session = await getServerSession()
  if (!session?.user?.isAdmin) throw new Error('Unauthorized')
  
  return await prisma.table.create({ data })
}
```

**Route Handlers for Complex Queries:**
```typescript
// app/api/admin/tables/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  
  const tables = await prisma.table.findMany({
    where: {
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
      type: type ? type : undefined,
    },
    include: { guests: true, primary_owner: true }
  })
  
  return Response.json(tables)
}
```

---

## Timeline Estimate

**Total Duration:** 1-2 weeks (assuming part-time development)

**Breakdown:**
- **Day 1:** Setup (shadcn/ui, theme, layout shell)
- **Days 2-3:** Core reusable components
- **Days 4-6:** Tables & Guests pages (most complex)
- **Days 7-8:** Orders, Invitations, Sync pages
- **Days 9-10:** Dashboard overview, Activity log, Polish

---

## Testing Strategy

### Manual Testing Checklist
- [ ] Admin authentication check works
- [ ] Non-admin users cannot access /admin routes
- [ ] All list pages load and display data correctly
- [ ] Search functionality works on all list pages
- [ ] Filters apply correctly
- [ ] Sorting works on all columns
- [ ] Create dialogs save data correctly
- [ ] Edit forms pre-populate and save
- [ ] Delete confirmations work
- [ ] Guest reassignment updates both tables
- [ ] Sheets sync triggers successfully
- [ ] Activity log records all actions
- [ ] CSV exports contain correct data

### Edge Cases to Test
- [ ] Empty states (no data in tables)
- [ ] Long table names (text truncation)
- [ ] Many guests at one table (pagination)
- [ ] Rapid successive actions (race conditions)
- [ ] Invalid form submissions
- [ ] Network errors during save

---

## Success Criteria

Phase 6 is complete when:

1. ✅ All 9 admin pages are functional
2. ✅ Event staff can perform all CRUD operations
3. ✅ Manual Sheets sync can be triggered
4. ✅ All list pages support search, filter, sort
5. ✅ Mobile responsive (tested on phone)
6. ✅ No accessibility violations (axe DevTools)
7. ✅ Loading states on all async operations
8. ✅ Error states handled gracefully
9. ✅ Activity log captures all admin actions
10. ✅ Tested with real data from Phase 5

---

## Next Steps After Phase 6

Once admin dashboard is complete, we proceed to:

**Phase 7: Frontend Integration**
- Migrate React prototype to Next.js App Router
- Apply Pink Gala brand colors
- Connect to real APIs
- Implement authentication flows
- Build public-facing checkout and dashboard

---

## Notes & Reminders

### Design Philosophy
- **Data-first**: Information is easy to scan
- **Minimal**: No unnecessary decoration
- **Fast**: Server components, minimal JS
- **Accessible**: Keyboard navigation, screen readers
- **Professional**: Neutral colors, clean typography

### Brand Separation
- **Admin**: Neutral, multi-tenant (Phase 6)
- **Public**: Pink Gala branded (Phase 7)

### Future Considerations
- Multiple organizations with separate admin views
- Role-based permissions beyond just admin/user
- Audit trail for compliance
- Advanced analytics dashboard
- Bulk import/export capabilities

---

*Document created: December 6, 2024*
*Last updated: December 6, 2024*
