// src/app/api/auth/session/route.ts
// GET current authenticated user session

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { user: null, authenticated: false },
        { status: 200 }
      );
    }

    // Return user without sensitive fields
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        is_super_admin: user.is_super_admin,
        isAdmin: user.isAdmin,
        organizationIds: user.organizationIds,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
