# Pink Gala Platform – Data Model Decisions & Rationale (v2)

**Version:** 2.0  
**Last Updated:** December 2024  
**Status:** Phase 1 – Schema Development (Ready for Migration)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Schema Changelog (v1 → v2)](#2-schema-changelog-v1--v2)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Pricing Model Deep Dive](#4-pricing-model-deep-dive)
5. [Entity-by-Entity Decisions](#5-entity-by-entity-decisions)
6. [Business Logic Rules](#6-business-logic-rules)
7. [Edge Cases & How They're Handled](#7-edge-cases--how-theyre-handled)
8. [Deferred Features](#8-deferred-features)
9. [Known Limitations](#9-known-limitations)
10. [Future Migration Path](#10-future-migration-path)

---

## 1. Executive Summary

### What This Platform Does

The Pink Gala Platform is a ticketing and table management system for charity gala events. It supports:

- **Table Hosts** who prepay for entire tables and invite guests to claim free seats
- **Table Captains** who reserve tables and recruit guests who pay individually
- **Individual Ticket Buyers** who may or may not be assigned to specific tables
- **Admin-Created Tables** with custom pricing (sponsor, corporate, comp tables)
- **Admin-Created Ticket Invitations** with custom pricing and payment links
- **Waitlist** at both event and table level
- **Event Check-In** with QR codes
- **Admin Operations** including guest reassignment, offline payment tracking, and Google Sheets sync

### Core Design Philosophy

1. **Stripe is the source of truth for online payments** – Orders created after successful payment
2. **Offline payments tracked separately** – TablePaymentStatus for sponsor/corporate tables
3. **Guest-centric seating** – No physical seat numbers; GuestAssignment = person in seat
4. **Placeholder seats are calculated, not stored** – Avoids ghost ticket records
5. **Single unified User model** – Everyone shares one identity
6. **Multi-organization ready** – Architecture supports future expansion

---

## 2. Schema Changelog (v1 → v2)

### 🔴 Bug Fixes (Required)

| Issue | v1 Problem | v2 Fix |
|-------|------------|--------|
| SheetRowMapping relations | Invalid polymorphic FK (two relations using same field) | Removed relations; use entity_type + entity_id with app-level resolution |
| PromoCode → Event | Missing relation caused orphan codes | Added proper relation with onDelete: Cascade |
| dietary_restrictions | `String[]` less flexible | Changed to `Json?` for extensibility |

### 🟡 New Features

| Feature | v2 Addition |
|---------|-------------|
| Table pricing | `custom_total_price_cents`, `seat_price_cents` fields |
| Offline payment tracking | `TablePaymentStatus` enum, `payment_status`, `payment_notes` |
| Table lifecycle | `TableStatus` enum (ACTIVE, CLOSED, ARCHIVED) |
| Admin ticket invitations | `is_admin_created`, `invited_email`, `custom_price_cents`, `payment_link_token`, `payment_link_expires` on Order |
| Order status expansion | Added `AWAITING_PAYMENT`, `EXPIRED` to OrderStatus |
| Anonymous waitlist | `WaitlistEntry.user_id` now nullable, added `email` field |
| Activity actions | Added `ORDER_INVITED`, `ORDER_EXPIRED` |

### 🟢 Optimizations

| Optimization | Change |
|--------------|--------|
| GuestAssignment query perf | Added composite index `@@index([event_id, table_id])` |
| Order lookups | Added `@@index([status])`, `@@index([payment_link_token])` |
| WaitlistEntry lookups | Added `@@index([email])` |

---

## 3. Architecture Decisions

### 3.1 Organization Layer

**Decision:** Add Organization model now, default to "Stepping Stone" for MVP.

**Rationale:**
- Adding organization scoping later requires painful migrations
- Enables future white-label or multi-charity scenarios
- Stripe accounts scope to org (`Organization.stripe_account_id`)
- Admins scope to specific orgs; Super Admins are global

---

### 3.2 Single Unified User Model

**Decision:** All people (hosts, captains, guests, admins) exist in one `User` table.

**Rationale:**
- Avoids duplicate identities and merge conflicts
- Magic link authentication works seamlessly
- Supports multi-event history
- Permission logic is cleaner

---

### 3.3 Guest-Centric Seat Model

**Decision:** No per-seat "Ticket" objects. `GuestAssignment` = one person occupying one seat.

**Rationale:**
- Gala events don't use assigned seat numbers
- Supports "buy 4 seats, name 2 guests now" workflow
- Placeholder seats calculated: `order.quantity - guest_assignments.count`
- Cleaner database; works naturally with Sheets

---

### 3.4 Table Types

| Type | Description | Payment | Guest Claims |
|------|-------------|---------|--------------|
| `PREPAID` | Host/sponsor pays for table | Offline or admin-created | Guests claim free seats |
| `CAPTAIN_PAYG` | Captain reserves table | Guests pay individually | Guests buy own seats |

---

### 3.5 Polymorphic References (SheetRowMapping, ActivityLog)

**Decision:** Use `entity_type` + `entity_id` pattern WITHOUT Prisma relations.

**Rationale:**
- Prisma doesn't support true polymorphic relations
- v1 attempted dual relations on same field → migration failure
- App-level resolution is standard pattern for audit logs

**Usage:**
```typescript
// Resolving a SheetRowMapping entity
if (mapping.entity_type === 'TABLE') {
  const table = await prisma.table.findUnique({ where: { id: mapping.entity_id } });
}
```

---

## 4. Pricing Model Deep Dive

### 4.1 Overview

The platform supports multiple pricing scenarios through a layered approach:

```
Product.price_cents           → Base price (e.g., $250 standard ticket)
Table.custom_total_price_cents → Override for entire table (e.g., $5,000 sponsor)
Table.seat_price_cents        → Override for per-seat price (e.g., $0 for claim-free)
Order.custom_price_cents      → Override for specific order (admin invitations)
```

### 4.2 Table Pricing Scenarios

| Scenario | Table Type | custom_total | seat_price | Payment Status | How Guests Join |
|----------|------------|--------------|------------|----------------|-----------------|
| **Sponsor table** ($5,000 total, free seats) | PREPAID | 500000 | 0 | PAID_OFFLINE | Claim free |
| **Comp table** ($0 total) | PREPAID | 0 | 0 | COMPED | Claim free |
| **Reserved captain table** ($600 total, $60/seat) | CAPTAIN_PAYG | 60000 | null (derived) | NOT_APPLICABLE | Pay $60 each |
| **Regular captain table** | CAPTAIN_PAYG | null | null | NOT_APPLICABLE | Pay Product price |
| **Corporate prepaid** ($3,000 custom) | PREPAID | 300000 | 0 | UNPAID → PAID_OFFLINE | Claim free |

### 4.3 Price Resolution Logic

```typescript
function getSeatPrice(table: Table, product: Product): number {
  // 1. Explicit seat price set (including $0 for free)
  if (table.seat_price_cents !== null) {
    return table.seat_price_cents;
  }
  
  // 2. Derive from table total ÷ capacity
  if (table.custom_total_price_cents !== null && table.capacity > 0) {
    return Math.round(table.custom_total_price_cents / table.capacity);
  }
  
  // 3. Fall back to product catalog price
  return product.price_cents;
}
```

### 4.4 Admin-Created Ticket Invitations

**Use Case:** Admin creates a reserved ticket for a specific person at a custom price.

**Flow:**
1. Admin creates Order:
   - `is_admin_created = true`
   - `status = AWAITING_PAYMENT`
   - `invited_email = "vip@example.com"`
   - `custom_price_cents = 10000` (or null for product price)
   - `payment_link_token = "abc123..."` (generated)
   - `payment_link_expires = now() + 7 days`

2. System emails recipient with link: `/pay/abc123...`

3. Recipient clicks link, pays via Stripe at custom price

4. Webhook:
   - Updates `status = COMPLETED`
   - Creates/links User record
   - Creates GuestAssignment

5. If expired:
   - Cron job updates `status = EXPIRED`
   - Logs `ORDER_EXPIRED` activity

### 4.5 Offline Payment Workflow

**Use Case:** Corporate sponsor pays $5,000 via check for a full table.

**Flow:**
1. Admin creates Table:
   - `type = PREPAID`
   - `custom_total_price_cents = 500000`
   - `seat_price_cents = 0`
   - `payment_status = UNPAID`

2. Admin sends invoice (outside system)

3. Check received → Admin updates:
   - `payment_status = PAID_OFFLINE`
   - `payment_notes = "Check #1234 received 10/15/2025"`

4. Guests receive invites and "claim" free seats

---

## 5. Entity-by-Entity Decisions

### 5.1 Organization

| Field | Type | Decision |
|-------|------|----------|
| `stripe_account_id` | String? | One Stripe Connect account per org |
| `slug` | String (unique) | URL-safe identifier |

### 5.2 User

| Field | Type | Decision |
|-------|------|----------|
| `supabase_auth_id` | String? (unique) | Links to Supabase Auth session |
| `is_super_admin` | Boolean | Global admin flag (simple, clear) |
| `phone` | String? | Collected for future SMS |
| `sms_opt_in` | Boolean | TCPA compliance |

### 5.3 Event

| Field | Type | Decision |
|-------|------|----------|
| `google_sheets_id` | String? | One Sheets config per event |
| `tickets_on_sale` | Boolean | Toggle availability without deletion |

### 5.4 Table

| Field | Type | Decision |
|-------|------|----------|
| `name` | String | Public display name |
| `internal_name` | String? | Admin-only reference |
| `table_number` | String? | Physical venue number |
| `status` | TableStatus | ACTIVE, CLOSED, ARCHIVED |
| `custom_total_price_cents` | Int? | Total table price override |
| `seat_price_cents` | Int? | Per-seat price override |
| `payment_status` | TablePaymentStatus | Offline payment tracking |
| `payment_notes` | String? | "Check #1234 received..." |

### 5.5 Order

| Field | Type | Decision |
|-------|------|----------|
| `status` | OrderStatus | PENDING, AWAITING_PAYMENT, COMPLETED, REFUNDED, CANCELLED, EXPIRED |
| `is_admin_created` | Boolean | Distinguishes admin invitations |
| `invited_email` | String? | Recipient email for invitations |
| `custom_price_cents` | Int? | Override product price |
| `payment_link_token` | String? (unique) | URL token for `/pay/{token}` |
| `payment_link_expires` | DateTime? | Default 7 days |

### 5.6 GuestAssignment

| Field | Type | Decision |
|-------|------|----------|
| `table_id` | String? | Nullable for unassigned guests |
| `dietary_restrictions` | Json? | Flexible structure for restrictions + notes |
| `bidder_number` | String? | Auction integration |
| `checked_in_at` | DateTime? | Null = not checked in |
| `qr_code_token` | String? (unique) | Globally unique for security |

### 5.7 WaitlistEntry

| Field | Type | Decision |
|-------|------|----------|
| `user_id` | String? | Nullable for anonymous signups |
| `email` | String? | Required if user_id is null |
| `table_id` | String? | Null = general waitlist |

---

## 6. Business Logic Rules

### 6.1 Guest Removal Permissions

| Table Type | Actor | Can Remove? |
|------------|-------|-------------|
| PREPAID | Owner/Co-owner/Manager | ✅ Any guest |
| CAPTAIN_PAYG | Captain | ❌ Self-paying guests |
| CAPTAIN_PAYG | Captain | ✅ Guests they assigned |
| Any | Org Admin / Super Admin | ✅ Any guest |

### 6.2 Guest Reassignment

- **Who can:** Org Admins, Super Admins only
- **What changes:** `GuestAssignment.table_id`
- **What stays:** `Order.table_id` (preserves purchase record)
- **Logging:** ActivityLog with `GUEST_REASSIGNED`, metadata includes from/to tables
- **Notification:** Planned for future (schema ready)

### 6.3 Ticket Transfer

- **Who can:** Guest themselves via magic link
- **What changes:** `GuestAssignment.user_id` → new user
- **What stays:** `Order.user_id` (original purchaser)
- **New user creation:** Auto-create if doesn't exist
- **Logging:** ActivityLog with `TICKET_TRANSFERRED`

### 6.4 Payment Link Expiration

- **Default:** 7 days from creation
- **Check:** Cron job or on-access validation
- **Action:** Update `Order.status = EXPIRED`
- **Re-invite:** Admin can create new order with new token

---

## 7. Edge Cases & How They're Handled

### 7.1 User Buys 4 Seats, Names 2 Guests

**Handling:**
- Order.quantity = 4
- Create 2 GuestAssignments
- Placeholder seats = 4 - 2 = 2 (calculated)
- User adds more guests later via dashboard

### 7.2 Captain Doesn't Buy Their Own Ticket

**Handling:**
- Captain Commitment order (quantity = 0, amount = 0)
- TableUserRole with role = CAPTAIN
- Dashboard shows "Buy My Ticket" nudge
- Captain purchases later

### 7.3 Admin Creates $0 Ticket for VIP

**Handling:**
- Create Order with `custom_price_cents = 0`, `is_admin_created = true`
- Status immediately set to `COMPLETED` (no payment needed)
- GuestAssignment created
- No Stripe involvement

### 7.4 Payment Link Clicked After Expiration

**Handling:**
- Check `payment_link_expires` on page load
- If expired: Show "Link expired" message
- User contacts admin for new invitation

### 7.5 Sponsor Table: Payment Received Before Admin Updates

**Handling:**
- Table created with `payment_status = UNPAID`
- Guests can still be invited (optional business decision)
- Admin updates to `PAID_OFFLINE` when check clears
- No dependency between payment status and guest claiming

### 7.6 Same User on Multiple Tables

**Handling:**
- Schema allows (no unique constraint on user_id + event_id)
- Edge case: VIP might have a seat at sponsor table AND personal table
- Admin report can flag duplicates
- Consider adding constraint if this should be prevented

### 7.7 Waitlist Entry: Anonymous Then Creates Account

**Handling:**
- WaitlistEntry created with `email`, `user_id = null`
- User later creates account with same email
- App logic should link: find WaitlistEntry by email, set user_id

---

## 8. Deferred Features

### 8.1 Schema Ready, Implementation Deferred

| Feature | Schema Support | Notes |
|---------|----------------|-------|
| SMS Notifications | `User.phone`, `sms_opt_in` | Need Twilio/SNS integration |
| Waitlist | Full model | No UI/conversion logic yet |
| QR Code Check-In | `qr_code_token` field | Generation + scanning deferred |
| Activity Log | Full model + actions | Logging middleware deferred |
| Promo Codes | Full model | UI/validation logic deferred |
| Payment Link Expiration | `payment_link_expires` field | Cron job to expire orders deferred |

### 8.2 Explicitly Out of Scope

| Feature | Reason |
|---------|--------|
| Invoicing | Not needed; offline payments tracked manually |
| Automatic Table Forfeiture | Admin handles manually |
| Partial Refunds | Handle in Stripe directly |
| Mobile App | Web-first |
| Multi-Currency | US-only |
| Seat Numbers | Gala seating is informal |

---

## 9. Known Limitations

### 9.1 No Seat Numbers

Physical seat numbers at tables are not tracked. Check-in is per-guest, not per-seat.

### 9.2 Single Payment Method per Order

No support for split payments or installments.

### 9.3 No Partial Refunds in Schema

Order.status is all-or-nothing. Handle partial refunds in Stripe.

### 9.4 WaitlistEntry Constraint

"Either user_id OR email must be set" enforced in application, not database.

### 9.5 Timezone Handling

Event.event_date stored as UTC. Display logic must convert to venue timezone.

---

## 10. Future Migration Path

### 10.1 Phone Verification

```prisma
model User {
  phone_verified    Boolean  @default(false)
  phone_verified_at DateTime?
}
```

### 10.2 Notification Preferences

```prisma
model NotificationPreference {
  id       String @id
  user_id  String
  channel  NotificationChannel // EMAIL, SMS
  category NotificationCategory // ORDER, REMINDER, MARKETING
  enabled  Boolean @default(true)
  
  @@unique([user_id, channel, category])
}
```

### 10.3 Seat-Level Tracking (if needed for future events)

```prisma
model Seat {
  id          String @id
  table_id    String
  seat_number Int
  
  @@unique([table_id, seat_number])
}

model GuestAssignment {
  seat_id String?
  seat    Seat? @relation(fields: [seat_id], references: [id])
}
```

---

## Appendix A: Enum Reference

```prisma
enum TableType { PREPAID, CAPTAIN_PAYG }
enum TableStatus { ACTIVE, CLOSED, ARCHIVED }
enum TablePaymentStatus { NOT_APPLICABLE, UNPAID, PAID_OFFLINE, COMPED }
enum TableRole { OWNER, CO_OWNER, CAPTAIN, MANAGER, STAFF }
enum ProductKind { INDIVIDUAL_TICKET, FULL_TABLE, CAPTAIN_COMMITMENT, DONATION, FEE_UPSELL }
enum ProductTier { STANDARD, VIP, VVIP }
enum OrderStatus { PENDING, AWAITING_PAYMENT, COMPLETED, REFUNDED, CANCELLED, EXPIRED }
enum PromoDiscountType { PERCENTAGE, FIXED_AMOUNT }
enum WaitlistStatus { WAITING, CONVERTED, EXPIRED, CANCELLED }
enum ActivityAction { GUEST_ADDED, GUEST_REMOVED, GUEST_UPDATED, GUEST_REASSIGNED, 
  GUEST_CHECKED_IN, TICKET_TRANSFERRED, TABLE_CREATED, TABLE_UPDATED, TABLE_DELETED,
  TABLE_ROLE_ADDED, TABLE_ROLE_REMOVED, ORDER_CREATED, ORDER_COMPLETED, ORDER_REFUNDED,
  ORDER_CANCELLED, ORDER_INVITED, ORDER_EXPIRED, USER_CREATED, USER_UPDATED, USER_LOGIN,
  ADMIN_OVERRIDE, SHEETS_SYNC, WAITLIST_CONVERTED }
enum EntityType { USER, TABLE, GUEST_ASSIGNMENT, ORDER, EVENT, ORGANIZATION, WAITLIST_ENTRY }
```

---

## Appendix B: Model Count

| Model | Count |
|-------|-------|
| Core | 8 (Organization, User, Event, Table, TableUserRole, Product, Order, GuestAssignment) |
| Tagging | 3 (Tag, TableTag, GuestTag) |
| Admin | 1 (OrganizationAdmin) |
| Features | 2 (PromoCode, WaitlistEntry) |
| Infrastructure | 3 (StripeEventLog, SheetRowMapping, ActivityLog) |
| **Total** | **17 models** |

---

## Appendix C: Index Summary

| Table | Indexes |
|-------|---------|
| User | email (unique), supabase_auth_id (unique) |
| Event | (organization_id, slug) unique, event_date |
| Table | (event_id, slug) unique, primary_owner_id, status |
| Order | event_id, user_id, table_id, stripe_payment_intent_id (unique), payment_link_token (unique), status |
| GuestAssignment | event_id, table_id, user_id, order_id, qr_code_token (unique), (event_id, table_id) composite |
| PromoCode | (event_id, code) unique |
| WaitlistEntry | event_id, table_id, user_id, email, status |
| ActivityLog | organization_id, event_id, actor_id, (entity_type, entity_id), action, created_at |

---

*This document should be updated as schema evolves. Last reviewed: December 2024.*
