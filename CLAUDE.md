# CLAUDE.md - AI Assistant Guide for Gala Ticket Platform

## Project Overview

The **Gala Ticket Platform** (Pink Gala Platform) is an event management system for gala events, handling:
- Table hosting and guest management
- Ticket purchases via Stripe
- Magic-link authentication via Supabase
- Google Sheets bidirectional sync for event staff
- Role-based permissions for table owners, captains, and staff

## Tech Stack (Bleeding-Edge Versions)

| Technology | Version | Notes |
|------------|---------|-------|
| Node.js | 25.x | Latest major release |
| Next.js | 16.0.7 | App Router only |
| React | 19.2.1 | With React Compiler |
| Prisma | 7.x | **Requires driver adapter** |
| Zod | 4.x | API changes from v3 |
| Tailwind CSS | 4.x | New architecture |
| Stripe | 20.x | Payment processing |
| Supabase | 2.86.x | Auth (magic links) + Postgres |

### Critical Version-Specific Requirements

#### Prisma 7 - Driver Adapter Required
```typescript
// WRONG - Will fail
const prisma = new PrismaClient();

// CORRECT - src/lib/prisma.ts pattern
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

#### Next.js 16 - Route Params are Promises
```typescript
// WRONG (Next.js 14 pattern)
export async function GET(request, { params }) {
  const { slug } = params;
}

// CORRECT (Next.js 15+ pattern)
export async function GET(request, { params }) {
  const { slug } = await params;
}
```

#### Supabase Auth - Use getUser() not getSession()
```typescript
// Avoid - security warning
const { data: { session } } = await supabase.auth.getSession();

// Preferred
const { data: { user } } = await supabase.auth.getUser();
```

## Project Structure

```
gala-ticket-platform/
├── prisma/
│   ├── schema.prisma          # Database schema (primary source of truth)
│   ├── migrations/            # SQL migrations
│   └── seed.ts               # Database seeding
├── src/
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   │   ├── auth/         # Login, logout, callback, session
│   │   │   ├── checkout/     # Stripe checkout flow
│   │   │   ├── guests/       # Guest CRUD + transfers
│   │   │   ├── orders/       # Order management
│   │   │   ├── tables/       # Table CRUD + dashboard
│   │   │   ├── webhooks/     # Stripe webhooks
│   │   │   └── sheets/       # Google Sheets sync
│   │   ├── dashboard/        # User dashboard page
│   │   ├── login/            # Magic link login page
│   │   ├── pay/[token]/      # Payment link page
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   └── lib/
│       ├── auth.ts           # Auth helpers (getCurrentUser, withAuth)
│       ├── permissions.ts    # Permission matrix + checks
│       ├── prisma.ts         # Prisma client singleton
│       ├── reference-codes.ts # Table/guest reference code generators
│       ├── stripe.ts         # Stripe client
│       ├── supabaseClient.ts # Browser Supabase client
│       ├── supabaseServer.ts # Server Supabase client
│       ├── sheets/           # Google Sheets sync engine
│       │   ├── client.ts     # Sheets API client
│       │   ├── exporter.ts   # DB → Sheets export
│       │   ├── importer.ts   # Sheets → DB import
│       │   └── sync.ts       # Bidirectional sync orchestrator
│       └── validation/       # Zod schemas
│           ├── index.ts      # Re-exports
│           ├── checkout.ts
│           ├── guests.ts
│           ├── orders.ts
│           └── tables.ts
└── docs/                     # Architecture & design docs
```

## Development Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check

# Database
npx prisma migrate dev     # Run migrations (dev)
npx prisma generate        # Regenerate Prisma client
npx prisma studio         # Open Prisma Studio GUI
npx tsx prisma/seed.ts    # Seed database

# Type checking
npx tsc --noEmit          # TypeScript check without emit
```

## Core Domain Models

### Key Entities (from prisma/schema.prisma)

| Model | Purpose |
|-------|---------|
| `Organization` | Top-level entity (event organizer) |
| `Event` | A gala event with date/venue |
| `Table` | Event table (PREPAID or CAPTAIN_PAYG) |
| `User` | Person in the system (guests, hosts, admins) |
| `Order` | Stripe-backed purchase record |
| `GuestAssignment` | Links a user to a table seat |
| `Product` | Purchasable items (tickets, tables, donations) |
| `TableUserRole` | Role assignment (OWNER, CO_OWNER, CAPTAIN, etc.) |

### Table Types

- **PREPAID**: Host pays for all seats upfront; host manages guest list
- **CAPTAIN_PAYG**: Captain recruits guests who pay individually

### Key Enums

```typescript
// Table types
TableType: PREPAID | CAPTAIN_PAYG

// Table roles (permission levels)
TableRole: OWNER | CO_OWNER | CAPTAIN | MANAGER | STAFF

// Order status
OrderStatus: PENDING | AWAITING_PAYMENT | COMPLETED | REFUNDED | CANCELLED | EXPIRED

// Product kinds
ProductKind: INDIVIDUAL_TICKET | FULL_TABLE | CAPTAIN_COMMITMENT | DONATION | FEE_UPSELL
```

## API Patterns

### Route Handler Structure
```typescript
// src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { SomeSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Business logic...

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

### Validation Pattern
```typescript
// Always validate input with Zod
const body = await request.json();
const data = SomeSchema.parse(body); // Throws ZodError on invalid

// Handle ZodError in catch block
if (error instanceof Error && error.name === 'ZodError') {
  return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
}
```

### Permission Checks
```typescript
import { checkTablePermission, checkRemoveGuestPermission } from '@/lib/permissions';

// Check table-level permission
const perm = await checkTablePermission(userId, tableId, 'edit');
if (!perm.allowed) {
  return NextResponse.json({ error: perm.reason }, { status: 403 });
}

// Special check for guest removal (CAPTAIN_PAYG rules)
const removePerm = await checkRemoveGuestPermission(userId, guestAssignmentId);
```

### Activity Logging
All mutations should log to `ActivityLog`:
```typescript
await prisma.activityLog.create({
  data: {
    organization_id: orgId,
    event_id: eventId,
    actor_id: user.id,
    action: 'GUEST_ADDED', // See ActivityAction enum
    entity_type: 'GUEST_ASSIGNMENT',
    entity_id: guestAssignment.id,
    metadata: { /* context */ },
  },
});
```

## Permission Matrix

| Table Type | Role | View | Edit | Add Guest | Remove Guest | Manage Roles |
|------------|------|------|------|-----------|--------------|--------------|
| PREPAID | OWNER | Yes | Yes | Yes | Yes | Yes |
| PREPAID | CO_OWNER | Yes | Yes | Yes | Yes | No |
| PREPAID | MANAGER | Yes | Yes | Yes | Yes | No |
| PREPAID | STAFF | Yes | No | No | No | No |
| CAPTAIN_PAYG | CAPTAIN | Yes | Yes | Yes | Own only* | No |
| Any | ADMIN | Yes | Yes | Yes | Yes | Yes |

*CAPTAIN_PAYG: Captains cannot remove guests who paid for themselves.

## Reference Codes (Sheets Sync)

Tables and guests get immutable reference codes for Google Sheets integration:

- **Tables**: `"25-T001"` (year prefix + sequential per event)
- **Guests**: `"G0001"` (sequential per organization)

Generated via `src/lib/reference-codes.ts` on creation.

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | `getCurrentUser()`, `withAuth()`, `requireAdmin()` |
| `src/lib/permissions.ts` | Permission matrix, `checkTablePermission()` |
| `src/lib/prisma.ts` | Singleton Prisma client with driver adapter |
| `src/lib/validation/*.ts` | Zod schemas for all API inputs |
| `prisma/schema.prisma` | Database schema - source of truth |

## Environment Variables

Required in `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Database
DATABASE_URL="postgresql://..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="https://..."

# Google Sheets (optional)
GOOGLE_SHEETS_CLIENT_EMAIL="..."
GOOGLE_SHEETS_PRIVATE_KEY="..."
GOOGLE_SHEETS_SPREADSHEET_ID="..."
```

## Common Development Tasks

### Adding a New API Endpoint
1. Create route file in `src/app/api/[resource]/route.ts`
2. Add Zod schema in `src/lib/validation/[resource].ts`
3. Use `getCurrentUser()` for auth
4. Use `checkTablePermission()` for authorization
5. Log activity for mutations

### Modifying the Database Schema
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Update validation schemas if needed
4. Update API routes if needed

### Adding a New Table Role Permission
1. Update `ROLE_PERMISSIONS` matrix in `src/lib/permissions.ts`
2. Update relevant permission check functions
3. Document in API route comments

## Code Style Conventions

- **Imports**: Use `@/*` alias for src imports
- **Error handling**: Always log errors with `console.error()`
- **Dates**: Store as `DateTime` in Prisma, use ISO strings in API
- **Money**: Store as cents (`Int`) in database
- **Slugs**: Lowercase alphanumeric with hyphens, validated by Zod
- **IDs**: Use Prisma CUID (default `@id @default(cuid())`)

## Testing API Endpoints

Use browser console or curl:
```javascript
// Browser console example
const res = await fetch('/api/tables?event_id=xxx');
const data = await res.json();
console.log(data);
```

## Known Behaviors

### User Dashboard vs Admin Dashboard
- `/dashboard` shows **user-specific** data (my tables, my tickets)
- Admin users can access any table via direct API calls
- Full admin dashboard is planned for Phase 7

### Sheets Sync
- Bidirectional: DB authoritative, Sheets for editorial overrides
- Sync is atomic per event
- Reference codes are immutable once assigned

## Documentation

Detailed docs in `/docs/`:
- `README-architecture.md` - System architecture
- `README-DATA-MODEL-DECISIONS-v2.md` - Schema design rationale
- `TECH-STACK-VERSIONS.md` - Version-specific issues and workarounds
- `PHASE*-COMPLETION-REPORT.md` - Implementation phase summaries
- `GETTING_STARTED.md` - Setup guide

## Important Notes for AI Assistants

1. **Always check version-specific patterns** - This project uses bleeding-edge versions with breaking changes from common examples online.

2. **Prisma 7 adapter is required** - Never instantiate `PrismaClient` without the `@prisma/adapter-pg` driver adapter.

3. **Route params are async** - Always `await params` in Next.js 16 route handlers.

4. **Permission checks are mandatory** - Use the permission system in `src/lib/permissions.ts` for all table/guest operations.

5. **Activity logging** - All mutations should create `ActivityLog` entries for audit trail.

6. **Reference codes are immutable** - Once a table or guest gets a reference code, it should never change.

7. **CAPTAIN_PAYG special rules** - Self-paying guests cannot be removed by captains; only admins or the guest themselves.

8. **Zod 4 syntax** - If referencing Zod documentation, ensure it's v4-compatible syntax.

---

*Last updated: December 2025*
*Development Phase: Post-Phase 5 (Sheets Sync)*
