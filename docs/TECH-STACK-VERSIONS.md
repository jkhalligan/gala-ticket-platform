# Pink Gala Platform — Tech Stack & Versions

**Last Updated:** December 4, 2025  
**Purpose:** Reference document to ensure consistency across development

---

## ⚠️ Important Notes

This project uses **bleeding-edge versions** of most dependencies. Several are major releases with breaking changes from previous versions:

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 25.x | Very new, may have compatibility issues |
| Next.js | 16.x | App Router only, new features |
| React | 19.x | New concurrent features |
| Prisma | 7.x | **Breaking:** Requires driver adapter |
| Zod | 4.x | API changes from v3 |
| Tailwind | 4.x | New architecture |

---

## Runtime Environment

| Component | Version |
|-----------|---------|
| **Node.js** | v25.1.0 |
| **npm** | 11.6.4 |
| **PostgreSQL** | 17.6 (aarch64-linux-gnu) |

---

## Core Dependencies

### Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.0.7 | React framework (App Router) |
| `react` | 19.2.0 | UI library |
| `react-dom` | 19.2.0 | React DOM renderer |

### Database

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | 7.1.0 | Database ORM |
| `prisma` | 7.1.0 | Prisma CLI (dev) |
| `@prisma/adapter-pg` | 7.1.0 | PostgreSQL driver adapter* |
| `pg` | 8.16.3 | PostgreSQL client |

> *⚠️ **Prisma 7 Breaking Change:** The client engine requires a driver adapter. You cannot use `new PrismaClient()` without an adapter.

### Authentication

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | 2.86.0 | Supabase client |
| `@supabase/auth-helpers-nextjs` | 0.15.0 | Auth helpers (deprecated)* |

> *⚠️ **Deprecated:** `@supabase/auth-helpers-nextjs` is deprecated. Consider migrating to `@supabase/ssr` in future.

### Payments

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | 20.0.0 | Stripe API client |

### Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `zod` | 4.1.13 | Schema validation |

### Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | 4.1.17 | CSS framework |
| `@tailwindcss/postcss` | 4.1.17 | PostCSS plugin |

### Background Jobs

| Package | Version | Purpose |
|---------|---------|---------|
| `inngest` | 3.46.0 | Background job processing |

### Email

| Package | Version | Purpose |
|---------|---------|---------|
| `resend` | 6.5.2 | Transactional email |

---

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.9.3 | TypeScript compiler |
| `@types/node` | 20.19.25 | Node.js types |
| `@types/react` | 19.2.7 | React types |
| `@types/react-dom` | 19.2.3 | React DOM types |
| `@types/pg` | 8.15.6 | PostgreSQL types |
| `eslint` | 9.39.1 | Linting |
| `eslint-config-next` | 16.0.7 | Next.js ESLint config |
| `babel-plugin-react-compiler` | 1.0.0 | React compiler (experimental) |
| `tsx` | 4.21.0 | TypeScript execution |

---

## Infrastructure

| Service | Details |
|---------|---------|
| **Database** | Supabase PostgreSQL 17.6 |
| **Auth** | Supabase Auth (Magic Links) |
| **Hosting** | Vercel (planned) |
| **Payments** | Stripe |

---

## Known Version-Specific Issues

### 1. Prisma 7 — Driver Adapter Required

**Problem:** `new PrismaClient()` fails with "requires adapter" error.

**Solution:** Must use driver adapter:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

### 2. Supabase Auth — getSession() Warning

**Problem:** Warning about using `getSession()` being insecure.

**Solution:** Use `getUser()` instead for server-side validation:

```typescript
// Instead of:
const { data: { session } } = await supabase.auth.getSession();

// Use:
const { data: { user } } = await supabase.auth.getUser();
```

### 3. Next.js 16 — Route Handler Params

**Problem:** Route params are now a Promise in Next.js 15+.

**Solution:** Await params in route handlers:

```typescript
// OLD (Next.js 14):
export async function GET(request, { params }) {
  const { slug } = params;
}

// NEW (Next.js 15+):
export async function GET(request, { params }) {
  const { slug } = await params;
}
```

### 4. Zod 4 — Import Changes

**Note:** Zod 4 may have different imports/APIs than Zod 3 examples found online. Always check the Zod 4 documentation.

---

## Recommended package.json

```json
{
  "name": "gala-ticket-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@prisma/adapter-pg": "^7.1.0",
    "@prisma/client": "^7.1.0",
    "@supabase/auth-helpers-nextjs": "^0.15.0",
    "@supabase/supabase-js": "^2.86.0",
    "inngest": "^3.46.0",
    "next": "16.0.7",
    "pg": "^8.16.3",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "resend": "^6.5.2",
    "stripe": "^20.0.0",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/pg": "^8.15.6",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.0.7",
    "prisma": "^7.1.0",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

---

## Version Lock Commands

To ensure consistent versions across environments:

```bash
# Check current versions
npm list --depth=0
node -v
npm -v

# Regenerate lock file (if issues)
rm -rf node_modules package-lock.json
npm install

# Verify Prisma client matches schema
npx prisma generate
```

---

## Upgrading Guidelines

Before upgrading any major dependency:

1. **Check breaking changes** in release notes
2. **Test in a branch** before merging
3. **Update this document** with new version
4. **Document any workarounds** needed

### High-Risk Upgrades (test carefully)

- `next` — App Router changes frequently
- `@prisma/client` — Schema/client compatibility
- `@supabase/*` — Auth flow changes
- `stripe` — API version changes

---

*Document created: December 4, 2025*
