# Phase 4 — Table Dashboard Backend: Completion Report

**Completed:** December 4, 2025  
**Status:** ✅ Complete and Tested

---

## Overview

Phase 4 implemented the table dashboard backend with comprehensive permission enforcement, seat management, guest operations, and ticket transfers. All endpoints are production-ready with full activity logging.

---

## Deliverables Completed

### Permission System (Enhanced)

| Deliverable | File | Status |
|-------------|------|--------|
| Full permission matrix | `src/lib/permissions.ts` | ✅ |
| CAPTAIN_PAYG special rules | `checkRemoveGuestPermission()` | ✅ |
| Ticket transfer permissions | `checkTicketTransferPermission()` | ✅ |
| Bulk permission retrieval | `getTablePermissions()` | ✅ |
| Role-based access control | All routes | ✅ |

### Table Dashboard

| Deliverable | File | Status |
|-------------|------|--------|
| Table with full dashboard data | `src/app/api/tables/[slug]/route.ts` | ✅ |
| Seat availability calculations | `calculateTableStats()` | ✅ |
| Guest list with user info | GET response includes `guests[]` | ✅ |
| Roles list | GET response includes `roles[]` | ✅ |
| User permissions in response | GET response includes `permissions{}` | ✅ |

### Guest Management

| Deliverable | File | Status |
|-------------|------|--------|
| List guests at table | `src/app/api/tables/[slug]/guests/route.ts` GET | ✅ |
| Add guest to table | `src/app/api/tables/[slug]/guests/route.ts` POST | ✅ |
| Get guest by ID | `src/app/api/guests/[id]/route.ts` GET | ✅ |
| Update guest info | `src/app/api/guests/[id]/route.ts` PATCH | ✅ |
| Remove guest from table | `src/app/api/guests/[id]/route.ts` DELETE | ✅ |
| Ticket transfer | `src/app/api/guests/[id]/transfer/route.ts` POST | ✅ |

### Role Management

| Deliverable | File | Status |
|-------------|------|--------|
| List table roles | `src/app/api/tables/[slug]/roles/route.ts` GET | ✅ |
| Add role to user | `src/app/api/tables/[slug]/roles/route.ts` POST | ✅ |
| Remove role from user | `src/app/api/tables/[slug]/roles/route.ts` DELETE | ✅ |

---

## Files Added/Modified

### New Files (4)

```
src/app/api/tables/[slug]/guests/route.ts    — List/add guests to table
src/app/api/tables/[slug]/roles/route.ts     — Manage table roles
src/app/api/guests/[id]/transfer/route.ts    — Ticket transfer endpoint
```

### Replaced Files (3)

```
src/lib/permissions.ts                       — Enhanced permission system
src/app/api/tables/[slug]/route.ts           — Enhanced table dashboard
src/app/api/guests/[id]/route.ts             — Permission-enforced guest CRUD
```

---

## API Endpoints Summary

### Table Dashboard (`/api/tables/[slug]`)

```
GET  /api/tables/[slug]   — Full dashboard: table, stats, guests, roles, permissions
PATCH /api/tables/[slug]  — Update table settings
```

**GET Response Structure:**
```typescript
{
  table: { id, name, slug, type, capacity, status, event, primary_owner, tags },
  stats: {
    capacity: number,
    total_purchased: number,
    filled_seats: number,
    placeholder_seats: number,
    remaining_capacity: number,
    is_full: boolean,
    is_fully_assigned: boolean,
    fill_percentage: number,
    assignment_percentage: number
  },
  guests: [...],
  roles: [...],
  permissions: {
    role: "OWNER" | "ADMIN" | etc,
    can_view: boolean,
    can_edit: boolean,
    can_add_guest: boolean,
    can_remove_guest: boolean,
    can_edit_guest: boolean,
    can_manage_roles: boolean,
    can_delete: boolean
  }
}
```

### Table Guests (`/api/tables/[slug]/guests`)

```
GET  /api/tables/[slug]/guests  — List guests with placeholder stats
POST /api/tables/[slug]/guests  — Add guest (claims placeholder seat)
```

### Table Roles (`/api/tables/[slug]/roles`)

```
GET    /api/tables/[slug]/roles  — List all roles including primary owner
POST   /api/tables/[slug]/roles  — Add role (CO_OWNER, CAPTAIN, MANAGER, STAFF)
DELETE /api/tables/[slug]/roles  — Remove role (cannot remove primary owner)
```

### Guest Operations (`/api/guests/[id]`)

```
GET    /api/guests/[id]           — Get guest with table, order, tags
PATCH  /api/guests/[id]           — Update display_name, dietary, bidder info
DELETE /api/guests/[id]           — Remove from table (respects CAPTAIN_PAYG rules)
POST   /api/guests/[id]/transfer  — Transfer ticket to another person
```

---

## Permission Matrix Implemented

| Table Type | Actor | View | Edit | Add Guest | Remove Guest | Edit Guest | Manage Roles |
|------------|-------|------|------|-----------|--------------|------------|--------------|
| PREPAID | Owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PREPAID | Co-owner | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PREPAID | Manager | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PREPAID | Staff | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| CAPTAIN_PAYG | Captain | ✅ | ✅ | ✅ | ⚠️* | ✅ | ❌ |
| Any | Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Any | Guest (self) | ✅ | ❌ | ❌ | ❌ | ✅ (self) | ❌ |

**⚠️ CAPTAIN_PAYG Rule:** Captains cannot remove guests who paid for themselves (`order.user_id === guest.user_id`).

---

## Seat Statistics Explained

| Stat | Description |
|------|-------------|
| `capacity` | Maximum seats at the table |
| `total_purchased` | Seats from COMPLETED orders |
| `filled_seats` | Seats with GuestAssignment records |
| `placeholder_seats` | `total_purchased - filled_seats` (unassigned purchased seats) |
| `remaining_capacity` | `capacity - total_purchased` (can still be sold) |
| `is_full` | No more seats can be purchased |
| `is_fully_assigned` | All purchased seats have guests assigned |
| `fill_percentage` | % of capacity purchased |
| `assignment_percentage` | % of purchased seats assigned |

---

## Activity Logging

All actions are logged to `ActivityLog` table:

| Action | Trigger |
|--------|---------|
| `GUEST_ADDED` | POST /api/tables/[slug]/guests |
| `GUEST_REMOVED` | DELETE /api/guests/[id] |
| `GUEST_UPDATED` | PATCH /api/guests/[id] |
| `TICKET_TRANSFERRED` | POST /api/guests/[id]/transfer |
| `TABLE_UPDATED` | PATCH /api/tables/[slug] |
| `TABLE_ROLE_ADDED` | POST /api/tables/[slug]/roles |
| `TABLE_ROLE_REMOVED` | DELETE /api/tables/[slug]/roles |

---

## Testing Results

All endpoints tested via browser console:

| Test | Endpoint | Result |
|------|----------|--------|
| Table dashboard | GET /api/tables/vip-table | ✅ Pass |
| List guests | GET /api/tables/vip-table/guests | ✅ Pass |
| List roles | GET /api/tables/vip-table/roles | ✅ Pass |
| Add guest | POST /api/tables/vip-table/guests | ✅ Pass |
| Get guest | GET /api/guests/[id] | ✅ Pass |
| Update guest | PATCH /api/guests/[id] | ✅ Pass |
| Transfer ticket | POST /api/guests/[id]/transfer | ✅ Pass |
| Add role | POST /api/tables/vip-table/roles | ✅ Pass |
| Remove guest | DELETE /api/guests/[id] | ✅ Pass |
| Remove role | DELETE /api/tables/vip-table/roles | ✅ Pass |

---

## Known Behaviors / Notes

### User Dashboard vs Admin Dashboard

The current `/dashboard` page shows **user-specific** data:
- **My Tables**: Only tables where the logged-in user is `primary_owner_id`
- **My Tickets**: Only `GuestAssignment` records for the logged-in user

This is **expected behavior**. Users with admin access can still access any table via direct URL (`/api/tables/[slug]`), but the dashboard intentionally shows personal data only.

**Admin Dashboard** (Phase 7) will provide:
- List all tables across the event
- List all guests across the event
- List all orders
- Bulk management operations
- Activity log viewer

---

## Next Steps

1. **Phase 5: Sheets Sync Engine** — Google Sheets bidirectional sync
2. **Phase 6: Frontend Integration** — Connect UI to these APIs
3. **Phase 7: Admin Dashboard** — Full admin control panel

---

## File Structure After Phase 4

```
src/
├── app/
│   └── api/
│       ├── tables/
│       │   ├── route.ts                    — List/create tables
│       │   └── [slug]/
│       │       ├── route.ts                — Table dashboard (Phase 4)
│       │       ├── guests/
│       │       │   └── route.ts            — Add/list guests (Phase 4)
│       │       └── roles/
│       │           └── route.ts            — Manage roles (Phase 4)
│       └── guests/
│           ├── route.ts                    — List/create guests
│           └── [id]/
│               ├── route.ts                — Guest CRUD (Phase 4)
│               └── transfer/
│                   └── route.ts            — Ticket transfer (Phase 4)
└── lib/
    └── permissions.ts                      — Permission system (Phase 4)
```

---

*Document generated: December 4, 2025*
