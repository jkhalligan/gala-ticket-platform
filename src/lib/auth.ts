// src/lib/auth.ts
// Authentication helpers for Supabase Auth + Prisma User sync

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { prisma } from './prisma';
import type { User } from '@prisma/client';

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// =============================================================================
// SESSION & USER SYNC
// =============================================================================

export type AuthUser = User & {
  isAdmin: boolean;
  organizationIds: string[];
};

/**
 * Get the current authenticated user from Supabase session
 * and sync/fetch from Prisma database
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
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
          { email: supabaseUser.email! },
        ],
      },
      include: {
        organization_admins: {
          select: { organization_id: true },
        },
      },
    });

    if (!user) {
      // Create new user on first login
      user = await prisma.user.create({
        data: {
          email: supabaseUser.email!,
          supabase_auth_id: supabaseUser.id,
          first_name: supabaseUser.user_metadata?.first_name || null,
          last_name: supabaseUser.user_metadata?.last_name || null,
        },
        include: {
          organization_admins: {
            select: { organization_id: true },
          },
        },
      });
    } else if (!user.supabase_auth_id) {
      // Link existing user (created via guest assignment) to Supabase auth
      user = await prisma.user.update({
        where: { id: user.id },
        data: { supabase_auth_id: supabaseUser.id },
        include: {
          organization_admins: {
            select: { organization_id: true },
          },
        },
      });
    }

    return {
      ...user,
      isAdmin: user.is_super_admin || user.organization_admins.length > 0,
      organizationIds: user.organization_admins.map((oa) => oa.organization_id),
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require admin role - throws if not admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

/**
 * Check if user is admin for a specific organization
 */
export async function isOrgAdmin(userId: string, organizationId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization_admins: {
        where: { organization_id: organizationId },
      },
    },
  });

  return user?.is_super_admin || (user?.organization_admins.length ?? 0) > 0;
}

// =============================================================================
// MAGIC LINK HELPERS
// =============================================================================

export async function sendMagicLink(email: string, redirectTo?: string) {
  const supabase = await getSupabaseServerClient();
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }

  return { success: true };
}

// =============================================================================
// API ROUTE HELPERS
// =============================================================================

/**
 * Wrapper for protected API routes
 */
export function withAuth<T>(
  handler: (user: AuthUser, request: Request) => Promise<T>
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        return Response.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      const result = await handler(user, request);
      return Response.json(result);
    } catch (error) {
      console.error('API error:', error);
      
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (error.message.includes('Forbidden')) {
          return Response.json({ error: error.message }, { status: 403 });
        }
      }

      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrapper for admin-only API routes
 */
export function withAdmin<T>(
  handler: (user: AuthUser, request: Request) => Promise<T>
) {
  return async (request: Request): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!user.isAdmin) {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }

      const result = await handler(user, request);
      return Response.json(result);
    } catch (error) {
      console.error('API error:', error);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
