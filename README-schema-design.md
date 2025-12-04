# Pink Gala Platform – Schema Design Overview

This document provides a high-level overview of the database schema used in the Pink Gala Ticketing & Table Management Platform. The design supports:

- Table Hosts
- Table Captains (Pay-as-you-go tables)
- Individual Ticket Buyers
- Mini-hosts buying multiple seats
- Guests (self-pay or assigned)
- Admin users
- Stripe-payment workflows
- Google Sheets sync workflows
- Multi-event year support

The schema supports complex relational permissions, multi-seat purchases, placeholder seats, and multi-role table ownership.

---

# 1. Core Entity List

### Users
Single identity for all people interacting with the system:
- Hosts
- Captains
- Guests
- Mini-hosts
- Individual buyers
- Admins

Guests are always promoted to users.

### Events
Supports multi-year operations.
Each event owns:
- Tables
- Products
- Orders
- Guest assignments

### Tables
Two types:
- PREPAID (host-paid full table)
- CAPTAIN_PAYG (captain recruits self-paying guests)

Each table has:
- One primary owner (host or captain)
- Zero or many co-owners/managers

### TableUserRoles
Join table mapping users → tables → roles.
Role enum:
- OWNER
- CO_OWNER
- CAPTAIN
- MANAGER
- STAFF

### Products
Event-specific:
- Individual tickets (Standard, VIP, VVIP)
- Full tables
- Donations / fee upsells
- Captain commitment ($0)

### Orders
Represents Stripe purchases.
Each order includes:
- user_id (buyer)
- event_id
- product_id
- table_id (if applicable)
- quantity (number of seats)
- amount (total)
- stripe_payment_intent_id

Supports placeholder seats:
`remaining_seats = quantity - assigned_guests`

### GuestAssignments
A guest occupying a seat at a table.
Includes:
- event_id
- table_id
- user_id
- order_id (self-pay or host-pay)
- dietary_restrictions
- auction_registered (sync with Sheets)

### StripeEventLog
Stores webhook events for idempotency.

### SheetRowMapping
Tracks mapping between DB entities and Google Sheets rows.
Used for incremental sync.

---

# 2. Relationships Overview

### Users
- 1 → many Orders
- 1 → many GuestAssignments
- many ↔ many Tables (via TableUserRoles)

### Tables
- 1 → many GuestAssignments
- 1 → many TableUserRoles
- belongs to one Event

### Orders
- 1 → many GuestAssignments
- belongs to one Table (optional)
- belongs to one User (buyer)
- belongs to one Event

### GuestAssignments
- belongs to one User
- belongs to one Table
- belongs to one Order
- belongs to one Event

---

# 3. Core Rules

### Guest Model Rules
- No seat numbers (free seating).
- GuestAssignment = one person in one seat.
- Placeholder seats = unassigned seats from Orders.

### Table Rules
- Primary owner is authoritative.
- Co-owners share some permissions.
- Captains cannot remove self-paying guests.
- Host can remove guests.

### Order Rules
- Multi-seat purchases allowed.
- Stripe is source of truth for amount paid.
- Removing a guest does NOT refund the order.

### Event Rules
- Tables and Orders are scoped per event.
- Users persist across event years.

### Sheets Sync Rules
- DB → Sheets: full export each sync.
- Sheets → DB: selective override for:
  - table_number
  - auction_registered

---

# 4. Stripe Integration Rules

- Only use `payment_intent.succeeded` for fulfillment.
- Log events to StripeEventLog.
- Avoid duplicating orders with idempotency checks.
- Use metadata for event_id and table_id.

---

# 5. Deletion & Cascade Policies

- Deleting an Event is blocked.
- Deleting a Table removes TableUserRoles but not Orders.
- Deleting a User is blocked except for admin actors.
- Deleting an Order removes GuestAssignments for that order.
- GuestAssignment deletions allowed for admin/host.

---

# 6. Indexes

Recommended indexes:

- Users: `email` (unique)
- Tables: `slug` (unique)
- TableUserRoles: composite (table_id, user_id, role)
- Orders: (table_id), (user_id)
- GuestAssignments: (table_id), (order_id), (user_id)
- Products: (event_id, kind, tier)
- SheetRowMapping: (entity_type, entity_id) unique

---

# 7. Future Migrations

- Add Promo Codes (optional)
- Add Group Codes (optional)
- Add Auction Integration Direct API (optional)
- Add Support for Multiple Ticket Classes Per Table (optional)

---

End of Schema Overview
