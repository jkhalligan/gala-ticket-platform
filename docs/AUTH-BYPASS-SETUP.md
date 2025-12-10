# Authentication Bypass System
## For Development & Vercel Preview Deployments

## Overview

This system allows bypassing Supabase magic link authentication in development and preview environments while keeping production secure.

**Use Cases:**
- Local development testing
- Vercel preview deployments
- Demo environments
- QA testing

**Security:**
- Only works when `NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true`
- Production automatically uses `false`
- No bypass code in production bundles

---

## Implementation

### Step 1: Update Environment Variables

#### `.env.local` (Local Development)
```bash
# Enable auth bypass for local dev
NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true
```

#### Vercel Project Settings (Preview Branches Only)

1. Go to: https://vercel.com/your-username/gala-ticket-platform/settings/environment-variables
2. Add new variable:
   - **Key:** `NEXT_PUBLIC_ENABLE_AUTH_BYPASS`
   - **Value:** `true`
   - **Environment:** ✅ Preview (ONLY Preview, not Production)
3. Redeploy preview branch

#### Production (Vercel)
**Do NOT add this variable to Production environment**
- Omitting the variable defaults to `false`
- Production stays secure

---

### Step 2: Update `src/lib/auth.ts`

Add these functions to your existing `src/lib/auth.ts`:

```typescript
// =============================================================================
// DEV AUTH BYPASS (Development & Preview Only)
// =============================================================================

/**
 * Check if auth bypass is enabled
 * Only works in development/preview, never in production
 */
export function isAuthBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS === 'true';
}

/**
 * Create a mock user for dev bypass
 * Used when ?devAuth=email@example.com is in URL
 */
export function createDevUser(email: string): AuthUser {
  const isAdmin = email.toLowerCase().includes('admin');
  
  return {
    id: `dev-user-${email}`,
    supabase_auth_id: `dev-auth-${email}`,
    email,
    created_at: new Date(),
    updated_at: new Date(),
    isAdmin,
    organizationIds: isAdmin ? ['org-1'] : []
  };
}

/**
 * Get auth bypass user from query parameter
 * Usage: ?devAuth=admin@example.com
 */
export async function getDevBypassUser(): Promise<AuthUser | null> {
  // Only works if bypass is enabled
  if (!isAuthBypassEnabled()) {
    return null;
  }

  // Check if we're in a server component with searchParams
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const url = headersList.get('x-url') || headersList.get('referer');
    
    if (!url) return null;
    
    const urlObj = new URL(url);
    const devAuthEmail = urlObj.searchParams.get('devAuth');
    
    if (devAuthEmail && devAuthEmail.includes('@')) {
      console.log('🔓 Dev auth bypass active:', devAuthEmail);
      return createDevUser(devAuthEmail);
    }
  } catch (error) {
    // Not in a server component context, ignore
  }
  
  return null;
}

/**
 * Modified getCurrentUser with dev bypass support
 * Replace your existing getCurrentUser function with this
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // Try dev bypass first (only works if enabled)
  const devUser = await getDevBypassUser();
  if (devUser) {
    return devUser;
  }
  
  // Original Supabase auth flow
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    const supabaseUser = session.user;

    // Find or create user in Prisma
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { supabase_auth_id: supabaseUser.id },
          { email: supabaseUser.email! }
        ]
      },
      include: {
        organizationMemberships: {
          include: { organization: true }
        },
        organizationOwners: true
      }
    });

    if (!user && supabaseUser.email) {
      // Create new user
      user = await prisma.user.create({
        data: {
          supabase_auth_id: supabaseUser.id,
          email: supabaseUser.email,
        },
        include: {
          organizationMemberships: {
            include: { organization: true }
          },
          organizationOwners: true
        }
      });
    }

    if (!user) {
      return null;
    }

    // Check if user is admin
    const isAdmin = user.organizationOwners.length > 0;
    const organizationIds = user.organizationMemberships.map(m => m.organization_id);

    return {
      ...user,
      isAdmin,
      organizationIds
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}
```

---

### Step 3: Add Middleware for Query Param Persistence (Optional)

If you want the `?devAuth` param to persist across navigation:

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const devAuth = request.nextUrl.searchParams.get('devAuth');
  
  // If devAuth is present and bypass is enabled, set a cookie
  if (devAuth && process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS === 'true') {
    const response = NextResponse.next();
    
    // Set cookie with devAuth email (30 min expiry)
    response.cookies.set('dev-auth-email', devAuth, {
      maxAge: 60 * 30, // 30 minutes
      httpOnly: true,
      sameSite: 'lax',
    });
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
```

Then update `getCurrentUser()` to check cookies:

```typescript
export async function getDevBypassUser(): Promise<AuthUser | null> {
  if (!isAuthBypassEnabled()) {
    return null;
  }

  try {
    // Check URL first
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const url = headersList.get('x-url') || headersList.get('referer');
    
    if (url) {
      const urlObj = new URL(url);
      const devAuthEmail = urlObj.searchParams.get('devAuth');
      
      if (devAuthEmail && devAuthEmail.includes('@')) {
        console.log('🔓 Dev auth bypass (URL):', devAuthEmail);
        return createDevUser(devAuthEmail);
      }
    }
    
    // Check cookie if no URL param
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const devAuthEmail = cookieStore.get('dev-auth-email')?.value;
    
    if (devAuthEmail && devAuthEmail.includes('@')) {
      console.log('🔓 Dev auth bypass (Cookie):', devAuthEmail);
      return createDevUser(devAuthEmail);
    }
  } catch (error) {
    // Ignore
  }
  
  return null;
}
```

---

## Usage

### Local Development

**Option 1: Add to URL**
```
http://localhost:3000?devAuth=admin@example.com
http://localhost:3000/dashboard?devAuth=user@example.com
```

**Option 2: Bookmark for Quick Access**
```
http://localhost:3000?devAuth=admin@example.com
http://localhost:3000?devAuth=tablehost@example.com
http://localhost:3000?devAuth=captain@example.com
http://localhost:3000?devAuth=guest@example.com
```

### Vercel Preview Deployments

```
https://gala-ticket-platform-git-frontend-v1-1-yourname.vercel.app?devAuth=admin@example.com
```

### Common Test Users

Create these bookmarks:

| Role | Email | URL |
|------|-------|-----|
| Admin | `admin@example.com` | `?devAuth=admin@example.com` |
| Table Host | `host@example.com` | `?devAuth=host@example.com` |
| Table Captain | `captain@example.com` | `?devAuth=captain@example.com` |
| Guest | `guest@example.com` | `?devAuth=guest@example.com` |

**Admin Detection:**
- Any email containing "admin" becomes an admin
- Example: `admin@test.com`, `superadmin@example.com`

---

## How It Works

### Flow Diagram

```
User visits page with ?devAuth=email@example.com
    ↓
getCurrentUser() called
    ↓
Is NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true?
    ├─ YES → Check for devAuth param
    │         ↓
    │    Found devAuth param?
    │         ├─ YES → Create mock user, return immediately
    │         └─ NO → Continue to real Supabase auth
    │
    └─ NO → Skip bypass, use real Supabase auth
```

### Security Checks

1. **Environment Variable:** Only works if explicitly enabled
2. **Email Validation:** Must contain `@` character
3. **Production Safety:** `NEXT_PUBLIC_` prefix means it's checked at build time
4. **No Bypass in Production:** Omitting variable in production = bypass disabled

---

## Testing the Bypass

### Test 1: Verify It's Working
```bash
# Start dev server
npm run dev

# Visit with bypass
open "http://localhost:3000?devAuth=test@example.com"

# Check console for:
# 🔓 Dev auth bypass active: test@example.com
```

### Test 2: Admin Access
```bash
open "http://localhost:3000/admin?devAuth=admin@example.com"

# Should have admin access
```

### Test 3: Regular User
```bash
open "http://localhost:3000/dashboard?devAuth=user@example.com"

# Should have user access, no admin
```

### Test 4: Production Simulation
```bash
# Temporarily disable bypass
export NEXT_PUBLIC_ENABLE_AUTH_BYPASS=false

npm run dev

# Visit with bypass param
open "http://localhost:3000?devAuth=admin@example.com"

# Should NOT bypass, redirects to login
```

---

## Troubleshooting

### Issue: Bypass Not Working Locally

**Check environment variable:**
```bash
# In terminal
echo $NEXT_PUBLIC_ENABLE_AUTH_BYPASS

# Should output: true
```

**Restart dev server:**
```bash
# Stop server (Ctrl+C)
# Start again
npm run dev
```

### Issue: Bypass Not Working on Vercel Preview

**Verify environment variable:**
1. Go to Vercel project settings
2. Environment Variables
3. Check `NEXT_PUBLIC_ENABLE_AUTH_BYPASS` exists
4. Confirm it's assigned to **Preview** environment only
5. Redeploy the branch

**Force redeploy:**
```bash
git commit --allow-empty -m "Force Vercel redeploy"
git push origin frontend-v1.1
```

### Issue: Bypass Working in Production (BAD!)

**This should NEVER happen if you followed instructions**

**Emergency fix:**
1. Go to Vercel → Environment Variables
2. Remove `NEXT_PUBLIC_ENABLE_AUTH_BYPASS` from Production
3. Redeploy production immediately

---

## Best Practices

### DO:
✅ Use `?devAuth=descriptive@email.com` for testing different roles
✅ Remove `devAuth` param before sharing screenshots
✅ Disable bypass when testing real auth flows
✅ Use admin emails for admin testing

### DON'T:
❌ Add bypass variable to Production environment
❌ Commit `.env.local` to git
❌ Share preview URLs with `devAuth` param publicly
❌ Rely on bypass for production debugging

---

## Future Improvements

### Optional Enhancements:

1. **Dev Auth UI** - Create a dev-only login page:
   - Dropdown with common test users
   - Quick role switching
   - Visual indicator when bypass is active

2. **Cookie Persistence** - Store bypass email in cookie:
   - Persists across page navigation
   - No need to add `?devAuth` to every URL
   - Clear cookie to "logout"

3. **Role Presets** - Predefined users with specific permissions:
   - `admin@dev` → Full admin access
   - `host@dev` → Table host with prepaid table
   - `captain@dev` → Captain with active table
   - `guest@dev` → Regular guest

---

## Summary

**One-Time Setup:**
1. Add `NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true` to `.env.local`
2. Add same variable to Vercel Preview environment
3. Update `src/lib/auth.ts` with bypass functions

**Daily Usage:**
```
http://localhost:3000?devAuth=yourname@test.com
https://preview-url.vercel.app?devAuth=yourname@test.com
```

**Production:**
- No changes needed
- Bypass automatically disabled
- Real Supabase auth works normally

You're now ready to develop without auth friction! 🎉
