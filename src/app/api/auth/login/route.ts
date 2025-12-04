// src/app/api/auth/login/route.ts
// POST: Send magic link to email

import { NextRequest, NextResponse } from 'next/server';
import { sendMagicLink } from '@/lib/auth';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  redirectTo: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, redirectTo } = LoginSchema.parse(body);

    // Build callback URL with redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = redirectTo 
      ? `${appUrl}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`
      : `${appUrl}/api/auth/callback`;

    await sendMagicLink(email, callbackUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid email' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Supabase rate limit or other errors
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a few minutes.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
