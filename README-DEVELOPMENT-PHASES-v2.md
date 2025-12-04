# Pink Gala Platform – Development Phases (Revised)

**Last Updated:** December 2024  
**Current Phase:** Phase 2

---

## Overview

This document outlines the development roadmap for the Pink Gala Platform. Phases have been revised from the original plan to reflect practical dependencies and lessons learned during Phase 1.

### Key Changes from Original Plan

1. **Authentication moved earlier** — Auth is foundational; needed before testing order ownership
2. **Stripe integration overlaps with Core API** — Building orders without Stripe means rewriting later
3. **Frontend integration split into sub-phases** — Significant refactoring needed from prototype
4. **Seed data expanded** — More comprehensive test data for development

---

## Phase Summary

| Phase | Name | Status |
|-------|------|--------|
| 0 | Environment & Infrastructure | ✅ Complete |
| 1 | Database Schema & Seed Data | ✅ Complete |
| 2 | Authentication & Core API | 🔄 Up Next |
| 3 | Stripe Integration & Order Flows | ⏳ Pending |
| 4 | Table Dashboard Backend | ⏳ Pending |
| 5 | Sheets Sync Engine | ⏳ Pending |
| 6 | Frontend Integration | ⏳ Pending |
| 7 | Admin Dashboard | ⏳ Pending |
| 8 | Testing, QA & Polish | ⏳ Pending |
| 9 | Launch Prep & Deployment | ⏳ Pending |

---

## Phase 0 — Environment & Infrastructure ✅ COMPLETE

### Deliverables
- [x] Next.js project initialized
- [x] Prisma 7 configured with `prisma.config.ts`
- [x] Supabase database connection verified
- [x] Stripe webhook endpoint created (returns 200 OK)
- [x] Environment variables configured
- [x] Repository scaffolded

### Outcome
Development environment is fully operational.

---

## Phase 1 — Database Schema & Seed Data ✅ COMPLETE

### Deliverables
- [x] Full Prisma schema (v2) with 17 models
- [x] All enum definitions
- [x] Relations, indexes, and constraints
- [x] Migration `init_schema_v2` applied
- [x] Prisma client generated
- [x] Seed data inserted:
  - [x] Organization (Stepping Stone)
  - [x] Super Admin user
  - [x] Event (50th Anniversary Pink Gala)
  - [x] Products (9 total: tickets, tables, captain commitments)
  - [x] Tags (7 total: VIP, Sponsor, Comp, etc.)

### Documentation Created
- [x] `schema.prisma` — Full database schema
- [x] `README-DATA-MODEL-DECISIONS-v2.md` — Architecture decisions & rationale
- [x] `SCHEMA-IMPLEMENTATION-GUIDE-v2.md` — Implementation patterns & queries

### Outcome
Complete relational backbone of the platform is operational.

---

## Phase 2 — Authentication & Core API 🔄 UP NEXT

### Why Auth First?
- Need real user sessions to test "who owns what"
- Permission logic depends on authenticated user identity
- Magic link login is simpler than it sounds with Supabase

### Deliverables

#### Authentication
- [ ] Magic link login flow with Supabase Auth
- [ ] `/login` page UI
- [ ] Session sync to Prisma User table (create user on first login)
- [ ] Auth middleware for protected routes
- [ ] `/api/auth/session` — Get current user
- [ ] `/api/auth/logout` — End session

#### Core API Routes
- [ ] `/api/tables` — CRUD operations
  - [ ] GET `/api/tables` — List tables (with filters)
  - [ ] GET `/api/tables/[slug]` — Get table by slug
  - [ ] POST `/api/tables` — Create table
  - [ ] PATCH `/api/tables/[id]` — Update table
- [ ] `/api/guests` — Guest assignment endpoints
  - [ ] GET `/api/guests` — List guests (with filters)
  - [ ] POST `/api/guests` — Assign guest to table
  - [ ] PATCH `/api/guests/[id]` — Update guest info
  - [ ] DELETE `/api/guests/[id]` — Remove guest
- [ ] `/api/users/me` — Current user profile
- [ ] Table slug resolution engine

#### Supporting Infrastructure
- [ ] `lib/prisma.ts` — Shared Prisma client with adapter
- [ ] `lib/auth.ts` — Auth helper functions
- [ ] Zod schemas for API input validation
- [ ] Permission checking utilities

### Outcome
- Users can log in via magic link
- Frontend can request and modify tables and guests
- Permission checks are enforced

---

## Phase 3 — Stripe Integration & Order Flows

### Deliverables
- [ ] PaymentIntent creation route (`/api/checkout`)
- [ ] Webhook handling (`/api/webhooks/stripe`)
  - [ ] `payment_intent.succeeded` → Create Order + GuestAssignment
  - [ ] Idempotency via StripeEventLog
- [ ] Order creation from webhook
- [ ] Placeholder seat logic (quantity - assigned guests)
- [ ] Multi-seat purchase flows
- [ ] Admin-created ticket invitations
  - [ ] Payment link generation
  - [ ] `/pay/[token]` checkout page
  - [ ] Expiration handling
- [ ] Promo code validation & application
- [ ] Error handling & retry logic

### Order Flows to Support
1. **Individual ticket purchase** — No table selected
2. **Individual ticket at table** — Joining existing table
3. **Full table purchase** — PREPAID table creation
4. **Captain commitment** — $0 order, creates CAPTAIN_PAYG table
5. **Admin ticket invitation** — Custom price, payment link
6. **Comp/free ticket** — $0, immediate completion

### Outcome
Real payments create real orders and real seats.

---

## Phase 4 — Table Dashboard Backend

### Deliverables
- [ ] Fetch table with all guests, orders, roles
- [ ] Seat availability calculations (filled, placeholder, remaining)
- [ ] Editing guest names and details
- [ ] Adding guests (with permission rules)
- [ ] Removing guests (with permission rules)
  - [ ] PREPAID: Owner can remove anyone
  - [ ] CAPTAIN_PAYG: Cannot remove self-paying guests
- [ ] Guest reassignment (admin only)
- [ ] Ticket transfer flow
- [ ] Mini-host flows (buy 4 seats, assign 2 now)
- [ ] Permission resolver for all table actions

### Permission Matrix Implementation
| Table Type | Actor | Add Guest | Remove Guest | Edit Guest |
|------------|-------|-----------|--------------|------------|
| PREPAID | Owner/Co-owner | ✅ | ✅ | ✅ |
| PREPAID | Manager | ✅ | ✅ | ✅ |
| CAPTAIN_PAYG | Captain | ✅ | ⚠️ Own only | ✅ |
| Any | Admin | ✅ | ✅ | ✅ |

### Outcome
Production-ready table management backend with full permission enforcement.

---

## Phase 5 — Sheets Sync Engine

### Deliverables
- [ ] Google Sheets API authentication
- [ ] Supabase cron-trigger function (or Vercel cron)
- [ ] DB → Sheets exporter
  - [ ] Tables sheet
  - [ ] Guests sheet
  - [ ] Orders sheet (optional)
- [ ] Sheets → DB importer (selective fields only)
  - [ ] `auction_registered`
  - [ ] `table_number`
  - [ ] `bidder_number`
- [ ] SheetRowMapping tracking
- [ ] Validation & conflict handling
- [ ] Manual sync trigger for admins

### Sync Rules
- **DB is source of truth** for identity, orders, assignments
- **Sheets can override** only designated fields
- **One-way for most data** to prevent loops

### Outcome
Event staff can manage tables in Google Sheets seamlessly.

---

## Phase 6 — Frontend Integration

### Why Split Into Sub-Phases?
The prototype in `50th-anniversary-pink-gala-portal` has significant UI logic that needs refactoring to work with real APIs and authentication.

### Phase 6a — API Connection & Data Fetching
- [ ] Set up API client utilities
- [ ] Replace mock data with real API calls
- [ ] Loading and error states
- [ ] Basic data display working

### Phase 6b — Authentication & User Sessions
- [ ] Login page integration
- [ ] Session management in React state
- [ ] Protected routes
- [ ] User context provider
- [ ] Role-based UI visibility

### Phase 6c — Interactive Features
- [ ] Table dashboard UI (fully functional)
- [ ] Captain table page
- [ ] Individual checkout flow
- [ ] Table checkout flow
- [ ] Guest onboarding modals
- [ ] Seat claiming (for PREPAID tables)

### Phase 6d — Polish & Edge Cases
- [ ] Status messaging
- [ ] Form validation feedback
- [ ] Optimistic updates
- [ ] Error recovery
- [ ] Mobile responsiveness
- [ ] Accessibility review

### Outcome
Fully functional attendee-facing interface.

---

## Phase 7 — Admin Dashboard

### Deliverables
- [ ] Admin authentication check
- [ ] List all tables (with filters, search)
- [ ] List all orders (with filters, search)
- [ ] List all guests (with filters, search)
- [ ] Manually assign/unassign seats
- [ ] Guest reassignment between tables
- [ ] Create admin tables (comp, sponsor, custom price)
- [ ] Create ticket invitations
- [ ] Override table ownership
- [ ] Mark offline payments received
- [ ] Trigger Sheets sync manually
- [ ] View activity log
- [ ] Waitlist management

### Outcome
Admin team gains full operational control.

---

## Phase 8 — Testing, QA & Polish

### Deliverables
- [ ] Unit tests (backend services)
- [ ] Route handler integration tests
- [ ] Stripe test mode flows (all payment scenarios)
- [ ] Permission testing (all role combinations)
- [ ] Manual testing checklist
- [ ] Load testing for ticket launch spike
- [ ] Error logging & observability (Sentry or similar)
- [ ] Security review
  - [ ] Auth edge cases
  - [ ] Permission bypasses
  - [ ] Input validation

### Test Scenarios
- [ ] Individual ticket purchase (new user)
- [ ] Individual ticket purchase (existing user)
- [ ] Captain creates table, recruits guests
- [ ] Host buys table, invites guests
- [ ] Guest claims seat at comp table
- [ ] Admin creates ticket invitation
- [ ] Guest transfers ticket
- [ ] Admin reassigns guest
- [ ] Promo code applied
- [ ] Payment fails and retries
- [ ] Webhook delivered twice (idempotency)

### Outcome
Ready for public ticket launch with confidence.

---

## Phase 9 — Launch Prep & Deployment

### Deliverables
- [ ] Production environment setup
- [ ] Production Stripe keys configured
- [ ] Production Supabase project
- [ ] Domain & SSL configured
- [ ] Email templates finalized (Resend/SendGrid)
- [ ] Monitoring & alerting configured
- [ ] Backup strategy confirmed
- [ ] Runbook for common issues
- [ ] Go-live checklist
- [ ] Rollback plan

### Launch Checklist
- [ ] `tickets_on_sale` flag ready to flip
- [ ] Support team briefed
- [ ] Social media / email blast scheduled
- [ ] Load test results reviewed
- [ ] Error tracking active

### Outcome
Platform is live and handling real ticket sales.

---

## Phase 10 — Post-Launch & Optional Enhancements

### Deferred Features (Schema Ready)
- [ ] SMS notifications (User.phone, sms_opt_in fields exist)
- [ ] Waitlist conversion workflow
- [ ] QR code check-in system
- [ ] Activity log UI

### Future Enhancements
- [ ] Donation-only flow
- [ ] Discount codes (beyond promo codes)
- [ ] Auction system direct API integration
- [ ] Mobile app version
- [ ] Email theming engine
- [ ] Export to PDF (table lists, guest lists)
- [ ] Multi-event dashboard

---

## Appendix: File Structure (Target)

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── session/route.ts
│   │   │   └── logout/route.ts
│   │   ├── tables/
│   │   │   ├── route.ts
│   │   │   └── [slug]/route.ts
│   │   ├── orders/
│   │   │   └── route.ts
│   │   ├── guests/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── checkout/
│   │   │   └── route.ts
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts
│   │   └── admin/
│   │       └── ...
│   ├── login/
│   │   └── page.tsx
│   ├── pay/
│   │   └── [token]/page.tsx
│   ├── table/
│   │   └── [slug]/page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   └── admin/
│       └── ...
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── stripe.ts
│   ├── permissions.ts
│   └── validation/
│       ├── tables.ts
│       ├── guests.ts
│       └── orders.ts
└── components/
    └── ...

prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

---

## Timeline Estimates

| Phase | Estimated Duration | Dependencies |
|-------|-------------------|--------------|
| Phase 2 | 1-2 weeks | — |
| Phase 3 | 1-2 weeks | Phase 2 |
| Phase 4 | 1 week | Phase 3 |
| Phase 5 | 1 week | Phase 4 |
| Phase 6 | 2-3 weeks | Phases 2-4 |
| Phase 7 | 1-2 weeks | Phase 4 |
| Phase 8 | 1-2 weeks | Phases 1-7 |
| Phase 9 | 3-5 days | Phase 8 |

**Total estimated:** 9-14 weeks for MVP launch

*Estimates assume 1 developer working part-time or with AI assistance.*

---

*This document should be updated as phases are completed.*
