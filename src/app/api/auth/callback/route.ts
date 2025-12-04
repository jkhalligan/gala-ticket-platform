// src/app/api/auth/callback/route.ts
// Handle Supabase magic link callback

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await getSupabaseServerClient();
    
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      // Redirect to login with error
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
  }

  // Redirect to the intended destination
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
