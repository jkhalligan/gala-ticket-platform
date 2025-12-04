# Pink Gala Platform – Development Phases

This document outlines the structured development roadmap for the Pink Gala Platform. The goal is to maintain clarity, reduce complexity, and ensure predictable progress through each milestone.

---

# Phase 0 — Environment & Infrastructure Readiness ✔ DONE
- Next.js project initialized
- Prisma configured
- Supabase database connection verified
- Stripe webhook validated (200 OK)
- Env vars loaded & tested
- Repository scaffolded

---

# Phase 1 — Database Schema Development (CURRENT PHASE)
Deliverables:
- Full Prisma schema
- Enum definitions
- Relations & indexes
- Migration `init_schema`
- Prisma client generated
- Insert seed data for Products

Outcome:
The entire relational backbone of the platform is created.

---

# Phase 2 — Core Backend API
Deliverables:
- /api/tables (CRUD)
- /api/orders (Stripe PaymentIntent creation)
- /api/guests (guest assignment endpoints)
- /api/auth routes (session, logout)
- Table slug resolution engine

Outcome:
Frontend can request and modify all core data structures.

---

# Phase 3 — Stripe Integration & Order Flows
Deliverables:
- PaymentIntent creation route
- Webhook handling for payment_intent.succeeded
- Order creation
- Placeholder seat logic
- Multi-seat purchase flows
- Error handling & retries

Outcome:
Real payments create real orders and real seats.

---

# Phase 4 — Magic Link Authentication & Permission System
Deliverables:
- Magic link login flow
- /login UI
- Session sync to Prisma User table
- Permission resolver for:
  - Host
  - Captain
  - Guest
  - Co-owner
  - Admin

Outcome:
Secure table dashboards with role-based controls.

---

# Phase 5 — Table Dashboard Logic
Deliverables:
- Fetch table with all guests
- Seat availability calculations
- Editing guest names
- Adding & removing guests (with permission rules)
- Mini-host flows (4 seats purchased, 2 assigned, etc.)

Outcome:
Production-ready table management backend.

---

# Phase 6 — Sheets Sync Engine
Deliverables:
- Supabase cron-trigger function
- DB → Sheets exporter
- Sheets → DB importer (selective fields)
- Validation & conflict handling

Outcome:
Event staff can manage tables in Google Sheets seamlessly.

---

# Phase 7 — Frontend Integration
Deliverables:
- Table dashboard UI
- Captain table page
- Individual checkout
- Table checkout
- Guest onboarding modals
- Status messaging & gamification

Outcome:
Fully functional attendee-facing interface.

---

# Phase 8 — Admin Dashboard
Deliverables:
- List all tables
- List all orders
- Manually assign/unassign seats
- Override table ownership
- Resync Sheets triggers

Outcome:
Admin team gains full operational control.

---

# Phase 9 — Testing, QA, and Polish
Deliverables:
- Unit tests (backend)
- Route handler integration tests
- Manual testing
- Stripe test mode flows
- Load testing for ticket launch
- Error logging & observability

Outcome:
Ready for public ticket launch.

---

# Phase 10 — Optional Enhancements
- Donation-only flow
- Discount codes
- Auction system direct API integration
- Mobile app version
- Email theming engine
- Export to PDF

---

End of Development Phases
