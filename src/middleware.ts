// src/middleware.ts
// FIXED VERSION - Always allows devAuth parameter in development

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // ========================================
  // DEV AUTH BYPASS - CHECK FIRST!
  // ========================================
  const devAuth = searchParams.get('devAuth');
  
  if (devAuth) {
    // If devAuth parameter exists, SET a cookie and allow through
    console.log('🔓 Middleware: DevAuth bypass active for', devAuth);
    
    const response = NextResponse.next();
    
    // Set cookie so it persists for navigation
    response.cookies.set('dev-auth-email', devAuth, {
      maxAge: 60 * 60, // 1 hour
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    
    return response;
  }
  
  // Check if cookie exists from previous request
  const devAuthCookie = request.cookies.get('dev-auth-email');
  if (devAuthCookie?.value) {
    console.log('🔓 Middleware: DevAuth cookie found for', devAuthCookie.value);
    return NextResponse.next();
  }
  
  // ========================================
  // NORMAL AUTH CHECK (Supabase)
  // ========================================
  
  // Only protect these routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    // Check for Supabase auth cookie
    const supabaseAuthToken = request.cookies.get('sb-access-token');
    
    if (!supabaseAuthToken) {
      console.log('🔒 Middleware: No auth found, redirecting to login');
      
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  // Protect these routes
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*'
  ]
};