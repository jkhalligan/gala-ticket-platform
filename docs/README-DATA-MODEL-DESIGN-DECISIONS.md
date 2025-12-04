# DATA-MODEL-DESIGN-DECISIONS.md

# Pink Gala Platform – Data Model Design Decisions  
_Deep Specification & Rationale for the Pink Gala Platform_

---

# 1. Introduction

This document captures **all decisions made so far regarding the data model** for the Pink Gala Ticketing & Table Management Platform. It explains the **entities**, **relationships**, **constraints**, and the **rationale** behind each choice.

This schema is designed to support:

- Table Hosts & Co-Hosts  
- Table Captains & Co-Captains  
- Pay-as-you-go seat purchasing  
- Prepaid full tables  
- Multi-seat purchases with placeholder seats  
- Guest assignment and self-service flows  
- Admin override rules  
- Stripe payments and reconciliation  
- Google Sheets syncing  
- Multi-year event support  
- Complex permission logic  

---

# 2. Identity Model

## 2.1 Single Unified User Model  
**Decision:** Every person—host, captain, guest, mini-host, admin—is stored in a single `User` table.

### Reasons  
- Avoids duplication of identities.  
- Ensures email-based magic link authentication works seamlessly.  
- Supports multi-event history.  
- Eliminates merging conflicts between “guest” and “user” accounts.  
- Clear and consistent permission logic.  

### Alternatives Rejected  
- **Separate Guest table** → Causes duplicate identities and confusing merges.  
- **Hybrid guest/user model** → Breaks magic link login and user history.  

---

# 3. Event Model

## 3.1 Multi-event Architecture  
A dedicated `Event` table allows scaling to future years (2026, 2027, 2028…).

### Reasons  
- Avoids table/order pollution over time.  
- Supports analytics and reporting across events.  
- Maintains clean data boundaries.  

---

# 4. Table Model

## 4.1 Tables Have One Primary Owner  
Stored in: `table.primary_owner_id`

### Reasons  
- Clear accountability for seat ownership.  
- Billing alignment with Stripe.  
- Reduces ambiguity in permissions.  

---

## 4.2 Role-Based Table Permissions (Join Table)

A join table `TableUserRoles` defines:

- `OWNER`  
- `CO_OWNER`  
- `CAPTAIN`  
- `MANAGER`  
- `STAFF`

### Reasons  
- Reflects real-life event staffing needs.  
- Allows multiple co-hosts.  
- Make role-based permission rules easy to enforce.  
- Avoids bloating the Table model.  

---

## 4.3 Table Types  
- **PREPAID** (host pays for all seats)  
- **CAPTAIN_PAYG** (captain recruits self-paying guests)

### Reasons  
- Drives permission logic.  
- Captains cannot remove self-paying guests.  
- Hosts have full control.  

---

# 5. Seating & Ticketing Model

## 5.1 Guest-Centric Seat Model (NO per-seat “Ticket” objects)

### GuestAssignment = A person occupying one seat

No seat numbering—gala events do not use assigned chairs.

### Placeholder Seats  
Calculated using:

```
remaining_seats = order.quantity - guest_assignments_count
```

### Reasons  
- Supports buying 4 seats but naming 2 guests now.  
- Avoids creating “ghost tickets”.  
- Cleaner database.  
- Better Sheets integration.  
- Matches real-world workflows.  

---

# 6. Order Model

Orders store Stripe transaction results.

Fields include:

- `event_id`  
- `user_id` (buyer)  
- `table_id` (optional)  
- `product_id`  
- `quantity`  
- `amount`  
- `stripe_payment_intent_id`  

### Reasons for Using Quantity  
- Supports multi-seat purchasing.  
- Supports partial assignment.  
- Cleaner than creating N tickets.  
- Reflects real-world gala purchasing.  

---

# 7. Product Model

Represents:

- Individual Tickets (Standard/VIP/VVIP)  
- Full Tables  
- Captain Commitment ($0)  
- Donation/Fee Upsell  

### Reasons  
- Required for Stripe SKU mapping.  
- Supports multiple price tiers.  
- Makes reporting easier.  

---

# 8. GuestAssignment Model

Stores per-seat guest identity & metadata:

- dietary restrictions  
- auction registration  
- order source  
- assignment to a table  

### Reasons  
- Cleanly separates users from seats.  
- Allows reassignment.  
- Works beautifully with Sheets rows.  
- Supports admin & host overrides.  

---

# 9. Stripe Integration

## 9.1 Use `payment_intent.succeeded` as Source of Truth

Triggers:

- Order creation  
- Guest assignment  
- Placeholder seat reservations  
- Table capacity updates  
- Email notifications  
- Sheets sync  

### Reasons  
- Stripe guarantees payment validity.  
- Avoids client-side fraud or manipulation.  
- Ensures idempotency.  

---

## 9.2 StripeEventLog Table  
Stores:

- event_id  
- payload  
- timestamps  
- processing status  

### Reasons  
- Prevent double-processing.  
- Debugging & audit trails.  
- Safe replay during testing.  

---

# 10. Sheets Sync Model

## 10.1 Sheets As “Human Override Layer”  
Sheets = staff-facing tool  
Database = source of truth

Sync direction:

- **DB → Sheets:** Full export  
- **Sheets → DB:** Only override these fields:
  - `auction_registered`
  - `table_number`
  - optional staff notes  

### Reasons  
- Prevent circular updates.  
- Avoid infinite sync loops.  
- Maintain data integrity.  

## 10.2 SheetRowMapping  
Tracks row number for each:

- Table  
- GuestAssignment  
- Order (optional)

### Reasons  
- Precise updates.  
- No row mismatching after sorting.  

---

# 11. Permissions Model

Permissions depend on:

1. User identity  
2. Table role  
3. Order ownership  
4. Event context  

### HOST (PREPAID)  
- Full control over table  
- Can add/remove guests  
- Can override guest info  

### CAPTAIN (PAYG)  
- Can view guest list  
- Cannot remove self-paying guests  
- Can invite additional guests  

### GUEST (self-pay)  
- Can edit own info only  

### MINI-HOST  
(User buying many seats at a Captain’s table)  
- Can assign their own purchased seats  
- Cannot manage others  

### ADMIN  
- Full override  

---

# 12. Cascade & Deletion Policies

Prevent:

- deleting users  
- deleting events  
- deleting tables with orders  

Allow:

- removing guest assignments  
- removing table roles  

Cascade:

- deleting an Order removes all GuestAssignments under it  
- deleting a TableUserRole doesn't affect the User record  

---

# 13. Why This Data Model Works

### ✔ Perfectly matches gala workflows  
### ✔ Supports partial assignment  
### ✔ Makes editors, hosts, and captains happy  
### ✔ Clean relational boundaries  
### ✔ Multi-event friendly  
### ✔ Stripe-first architecture  
### ✔ Sheets override safe  
### ✔ Very easy to extend  

---


End of DATA-MODEL-DESIGN-DECISIONS.md
