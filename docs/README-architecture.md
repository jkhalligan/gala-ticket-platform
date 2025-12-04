# Pink Gala Platform – Architecture Overview

## Overview
This document describes the core architecture of the Pink Gala Event Management Platform using:

- **Next.js (App Router)**
- **Prisma ORM**
- **Supabase (Postgres + Auth + Cron/Edge Functions)**
- **Stripe for payments**
- **Zod for validation**

The architecture supports:
- Magic-link authentication
- Table hosts, captains, guests, co-owners
- Multi-seat purchases with placeholder seats
- Google Sheets sync layer
- Permission-controlled table dashboards
- Stripe-based ticketing flows
- Slick, modern Next.js UI

## Tech Stack Summary
### Frontend
- Next.js App Router
- React Server Components
- TailwindCSS (optional)
- Zod schemas shared across client/server

### Backend (Inside Next.js)
- Route Handlers (`/app/api/...`)
- Server Actions for database mutations
- Prisma for relational data management
- Supabase Auth for session + magic link

### Infrastructure
- Supabase Postgres (DB)
- Supabase Auth (Magic Links)
- Supabase Cron or Inngest for background jobs
- Vercel for hosting

### Payments
- Stripe PaymentIntent API
- Webhooks handled via `/api/webhooks/stripe`

### Sheets Sync
- Scheduled cron tasks (Supabase or Vercel cron)
- Two-way selective sync:
  - DB → Sheets (authoritative push)
  - Sheets → DB (override columns only)

## Core Domain Concepts
### Users
Single identity across the system. Guests promoted to users automatically.

### Tables
- Primary owner + co-owners
- Type: PREPAID or CAPTAIN_PAYG
- Capacity and remaining seats derived dynamically

### Orders
Stripe-backed purchase records:
- Individual tickets
- Multi-seat buys
- Full-table purchases
- Table captain commitments ($0)

### Guest Assignments
Guest-centric model (no seat entities).  
Supports:
- Placeholder seats
- Named seats
- Reassignments
- Self-pay vs host-pay distinctions

### Permissions
Roles per table:
- OWNER
- CO_OWNER
- CAPTAIN
- MANAGER
- GUEST
- ADMIN

Enforced in server actions / API routes.

## API Architecture
### Example Modules
- `/api/tables`
- `/api/orders`
- `/api/guests`
- `/api/auth`
- `/api/sheets`
- `/api/webhooks/stripe`

### Validation
All input validation implemented with Zod schemas.

## Background Processing
- Supabase Edge Functions (cron): Sheets sync
- Stripe webhook ingestion
- Invitation email dispatch (via Resend or SendGrid)

---

