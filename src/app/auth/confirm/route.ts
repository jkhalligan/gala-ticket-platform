// src/app/auth/confirm/route.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const redirect = requestUrl.searchParams.get('redirect') || '/admin';

  if (token_hash && type) {
    const cookieStore = await cookies();

    // Create Supabase server client with cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Handle cookie setting errors during route handler execution
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Handle cookie removal errors during route handler execution
            }
          },
        },
      }
    );

    try {
      const { error } = await supabase.auth.verifyOtp({
        type: type as any,
        token_hash,
      });

      if (error) {
        console.error('Auth verification error:', error);
        return NextResponse.redirect(
          `${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`
        );
      }

      // Successfully authenticated - redirect to intended destination
      return NextResponse.redirect(`${requestUrl.origin}${redirect}`);
    } catch (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=authentication_failed`
      );
    }
  }

  // No token provided
  return NextResponse.redirect(`${requestUrl.origin}/login?error=no_token`);
}
