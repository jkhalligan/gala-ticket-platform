# Auth Bypass - Quick Implementation Prompt

## Task

Implement dev-only auth bypass so I can test Phase 3 dashboards by adding `?devAuth=email@example.com` to URLs.

## Files to Update

### 1. `src/lib/auth.ts`

Add these functions before the existing `getCurrentUser()`:

```typescript
export function isAuthBypassEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS === 'true';
}

export function createDevUser(email: string): AuthUser {
  const isAdmin = email.toLowerCase().includes('admin');
  return {
    id: `dev-user-${email}`,
    supabase_auth_id: `dev-auth-${email}`,
    email,
    created_at: new Date(),
    updated_at: new Date(),
    isAdmin,
    organizationIds: isAdmin ? ['org-1'] : [],
    organizationMemberships: [],
    organizationOwners: []
  };
}
```

Update `getCurrentUser()` to check for bypass FIRST:

```typescript
export async function getCurrentUser(): Promise<AuthUser | null> {
  // Dev bypass check
  if (isAuthBypassEnabled()) {
    try {
      const { headers } = await import('next/headers');
      const headersList = await headers();
      const referer = headersList.get('referer') || '';
      
      if (referer) {
        const url = new URL(referer);
        const devAuthEmail = url.searchParams.get('devAuth');
        
        if (devAuthEmail && devAuthEmail.includes('@')) {
          console.log('🔓 Dev auth bypass active:', devAuthEmail);
          return createDevUser(devAuthEmail);
        }
      }
    } catch (error) {
      // Continue to normal auth
    }
  }
  
  // ... rest of existing Supabase auth code stays the same
}
```

### 2. `src/middleware.ts` (create if doesn't exist)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Allow auth bypass
  if (process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS === 'true') {
    const devAuth = searchParams.get('devAuth');
    if (devAuth) {
      return NextResponse.next();
    }
  }
  
  // Protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const supabaseAuthToken = request.cookies.get('sb-access-token');
    
    if (!supabaseAuthToken && process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS !== 'true') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
};
```

### 3. `src/app/test-auth/page.tsx` (create new)

```typescript
import { getCurrentUser } from '@/lib/auth';

export default async function TestAuthPage({
  searchParams,
}: {
  searchParams: { devAuth?: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">❌ No Auth</h1>
          <p className="mb-4">Add <code>?devAuth=test@example.com</code> to URL</p>
          <p className="text-sm">Bypass enabled: {process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS || 'false'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl">
        <h1 className="text-2xl font-bold mb-4 text-green-600">✅ Auth Working!</h1>
        
        <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
{JSON.stringify({ id: user.id, email: user.email, isAdmin: user.isAdmin }, null, 2)}
        </pre>

        <div className="mt-4 space-y-2">
          <a href="/dashboard/tickets?devAuth=buyer@example.com" className="block text-blue-600">
            → Test Tickets Dashboard
          </a>
          <a href="/admin?devAuth=admin@example.com" className="block text-blue-600">
            → Test Admin (with admin email)
          </a>
        </div>
      </div>
    </div>
  );
}
```

### 4. `.env.local`

Add:
```bash
NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true
```

## Test

```bash
npm run dev
```

Open: http://localhost:3000/test-auth?devAuth=test@example.com

Should see: ✅ Auth Working!

## Commit

```bash
git add .
git commit -m "feat: add dev auth bypass for testing"
git push origin frontend-v1.1
```

## Done!

After deploying to Vercel, manually add `NEXT_PUBLIC_ENABLE_AUTH_BYPASS=true` to Preview environment only.

Then test with: `https://your-preview-url.vercel.app/dashboard/tickets?devAuth=buyer@example.com`
