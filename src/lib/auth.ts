// src/lib/auth.ts - FIXED VERSION
// Reads devAuth from cookie set by middleware

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export type AuthUser = {
  id: string;
  supabase_auth_id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  isAdmin: boolean;
  organizationIds: string[];
  organizationMemberships?: any[];
  organizationOwners?: any[];
};

// =============================================================================
// DEV AUTH BYPASS FUNCTIONS
// =============================================================================

export function createDevUser(email: string): AuthUser {
  const isAdmin = email.toLowerCase().includes('admin');
  
  console.log('🔓 Creating dev user:', { email, isAdmin });
  
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

async function getDevAuthEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const devAuthCookie = cookieStore.get('dev-auth-email');
    
    if (devAuthCookie?.value) {
      return devAuthCookie.value;
    }
  } catch (error) {
    console.error('Error reading dev auth cookie:', error);
  }
  
  return null;
}

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
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// =============================================================================
// CURRENT USER - WITH DEV BYPASS
// =============================================================================

export async function getCurrentUser(): Promise<AuthUser | null> {
  // ========================================
  // TRY DEV BYPASS FIRST
  // ========================================
  const devAuthEmail = await getDevAuthEmail();
  
  if (devAuthEmail) {
    console.log('🔓 Auth: Using dev bypass for', devAuthEmail);
    return createDevUser(devAuthEmail);
  }
  
  // ========================================
  // NORMAL SUPABASE AUTH
  // ========================================
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

  // Also clear dev auth cookie
  const cookieStore = await cookies();
  cookieStore.delete('dev-auth-email');

  return { success: true };
}

// =============================================================================
// API ROUTE HELPERS
// =============================================================================

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