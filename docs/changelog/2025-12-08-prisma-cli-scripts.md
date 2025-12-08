# Prisma CLI Scripts Addition - December 8, 2025

## Executive Summary

Added convenient npm scripts for Prisma database management with automatic environment variable loading from `.env.local`. This improves the developer experience by eliminating the need to manually specify environment files or use `npx` directly.

**Impact**: Developers can now easily access Prisma Studio, run migrations, and manage the database with simple commands.

---

## Changes Made

### 1. New NPM Scripts

Added four new scripts to `package.json`:

```json
{
  "scripts": {
    "studio": "dotenv -e .env.local -- npx prisma studio",
    "migrate": "dotenv -e .env.local -- npx prisma migrate dev",
    "db:push": "dotenv -e .env.local -- npx prisma db push",
    "db:seed": "dotenv -e .env.local -- npx prisma db seed"
  }
}
```

### 2. Installed dotenv-cli

Added `dotenv-cli@^11.0.0` as a dev dependency to enable environment variable loading from custom files.

---

## Script Usage

### Prisma Studio (Database GUI)

Open Prisma Studio to view and edit your database:

```bash
npm run studio
```

- Opens browser at `http://localhost:5555`
- Provides visual interface for database management
- Read and write data directly
- Inspect relationships and schema

### Database Migrations

Run pending migrations in development:

```bash
npm run migrate
```

Equivalent to: `npx prisma migrate dev`

- Applies new migrations
- Generates Prisma Client
- Updates database schema
- Interactive prompts for migration naming

### Database Push (Schema Sync)

Push schema changes without creating migrations:

```bash
npm run db:push
```

Equivalent to: `npx prisma db push`

- Syncs schema directly to database
- Useful for prototyping
- No migration files created
- ⚠️ Use with caution in production

### Database Seeding

Run the seed script to populate the database:

```bash
npm run db:seed
```

Equivalent to: `npx prisma db seed`

- Executes `prisma/seed.ts`
- Populates database with initial data
- Useful for development and testing

---

## Why dotenv-cli?

### Problem

By default, Prisma CLI commands use `.env` for environment variables, but Next.js development typically uses `.env.local`. This causes issues:

```bash
# ❌ Uses .env (may not exist or be incomplete)
npx prisma studio

# ❌ Manual workaround (verbose)
DATABASE_URL="postgresql://..." npx prisma studio

# ❌ Another workaround (still manual)
dotenv -e .env.local npx prisma studio
```

### Solution

`dotenv-cli` automatically loads environment variables from `.env.local` before running the command:

```bash
# ✅ Simple and uses correct environment file
npm run studio
```

### How It Works

```bash
dotenv -e .env.local -- npx prisma studio
│      │             │   │
│      │             │   └─ Command to run
│      │             └───── Separator
│      └─────────────────── Environment file to load
└────────────────────────── dotenv-cli binary
```

---

## Environment Variable Precedence

When running these scripts, environment variables are loaded in this order (later overrides earlier):

1. System environment variables
2. `.env` (if exists)
3. `.env.local` (via dotenv-cli)

This ensures your local database configuration takes precedence over defaults.

---

## Benefits

### Developer Experience

- ✅ **Simpler Commands** - No need to remember complex npx commands
- ✅ **Consistent Environment** - Always uses `.env.local`
- ✅ **Less Typing** - Shorter commands to run
- ✅ **Discoverable** - Listed in `npm run` output

### Before vs After

**Before**:
```bash
# View database
npx prisma studio

# Run migrations
npx prisma migrate dev

# Push schema
npx prisma db push

# Seed database
npx tsx prisma/seed.ts
```

**After**:
```bash
# View database
npm run studio

# Run migrations
npm run migrate

# Push schema
npm run db:push

# Seed database
npm run db:seed
```

---

## Configuration Requirements

### .env.local Must Contain

These scripts require `DATABASE_URL` in your `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/gala_platform"

# Other environment variables...
```

### Vercel Environment Variables

Note: These scripts are for **local development only**. Vercel deployments should have `DATABASE_URL` configured in the project settings.

---

## Common Tasks

### Initial Setup

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd gala-ticket-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up .env.local**
   ```bash
   cp .env .env.local
   # Edit .env.local with your database URL
   ```

4. **Run migrations**
   ```bash
   npm run migrate
   ```

5. **Open Prisma Studio**
   ```bash
   npm run studio
   ```

### Daily Development

```bash
# Start development server
npm run dev

# In another terminal, open database GUI
npm run studio

# Make schema changes
# Edit prisma/schema.prisma

# Apply changes
npm run migrate
```

---

## Troubleshooting

### "dotenv: command not found"

**Cause**: `dotenv-cli` not installed

**Fix**:
```bash
npm install
# or
npm install -D dotenv-cli
```

### "Environment variable not found: DATABASE_URL"

**Cause**: Missing or incorrect `.env.local` file

**Fix**:
1. Ensure `.env.local` exists in project root
2. Verify it contains `DATABASE_URL`
3. Check the connection string format

### Prisma Studio Won't Open

**Cause**: Port 5555 already in use

**Fix**:
```bash
# Kill existing process
lsof -ti:5555 | xargs kill -9

# Or specify different port
npx prisma studio --port 5556
```

---

## Related Documentation

- [Prisma CLI Reference](https://www.prisma.io/docs/reference/api-reference/command-reference)
- [Prisma Studio](https://www.prisma.io/docs/concepts/components/prisma-studio)
- [Database Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Seeding](https://www.prisma.io/docs/guides/database/seed-database)

---

## Future Enhancements

### Possible Additions

1. **Database Reset Script**
   ```json
   "db:reset": "dotenv -e .env.local -- npx prisma migrate reset"
   ```

2. **Generate Client Only**
   ```json
   "generate": "dotenv -e .env.local -- npx prisma generate"
   ```

3. **Format Schema**
   ```json
   "db:format": "npx prisma format"
   ```

4. **Validate Schema**
   ```json
   "db:validate": "npx prisma validate"
   ```

---

## Contributors

- Added by: Claude Code Agent
- Reviewed by: [Pending]

---

**Status**: ✅ Complete
**Date**: December 8, 2025
**Files Modified**:
- `package.json` (scripts + devDependencies)
- `package-lock.json` (dependency tree)
