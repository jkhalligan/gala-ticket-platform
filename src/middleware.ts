import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow auth bypass in dev mode
  if (process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS === 'true') {
    const devAuth = searchParams.get('devAuth');
    if (devAuth) {
      return NextResponse.next();
    }
  }

  // Protect dashboard routes (simplified - auth happens in page components)
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
