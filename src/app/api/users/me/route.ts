// src/app/api/users/me/route.ts
// GET: Get current user profile with related data
// PATCH: Update current user profile

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

// =============================================================================
// VALIDATION
// =============================================================================

const UpdateProfileSchema = z.object({
  first_name: z.string().max(50).nullable().optional(),
  last_name: z.string().max(50).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  sms_opt_in: z.boolean().optional(),
});

// =============================================================================
// GET - Get Current User Profile
// =============================================================================

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user data with related records
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        organization_admins: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        table_roles: {
          include: {
            table: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                event: {
                  select: {
                    id: true,
                    name: true,
                    event_date: true,
                  },
                },
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
        guest_assignments: {
          include: {
            table: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            event: {
              select: {
                id: true,
                name: true,
                event_date: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 10, // Limit to recent assignments
        },
        orders: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                kind: true,
                tier: true,
              },
            },
            table: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            event: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 10, // Limit to recent orders
        },
        owned_tables: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            status: true,
            capacity: true,
            event: {
              select: {
                id: true,
                name: true,
                event_date: true,
              },
            },
            _count: {
              select: {
                guest_assignments: true,
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
        activity_logs: {
          take: 20,
          orderBy: {
            created_at: 'desc',
          },
          select: {
            id: true,
            action: true,
            entity_type: true,
            entity_id: true,
            metadata: true,
            created_at: true,
          },
        },
      },
    });

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate summary stats
    const stats = {
      totalTables: fullUser.owned_tables.length + 
        fullUser.table_roles.filter(r => r.role !== 'STAFF').length,
      totalGuestAssignments: fullUser.guest_assignments.length,
      totalOrders: fullUser.orders.length,
      isAdmin: fullUser.is_super_admin || fullUser.organization_admins.length > 0,
    };

    return NextResponse.json({
      user: {
        id: fullUser.id,
        email: fullUser.email,
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        phone: fullUser.phone,
        sms_opt_in: fullUser.sms_opt_in,
        is_super_admin: fullUser.is_super_admin,
        created_at: fullUser.created_at,
        updated_at: fullUser.updated_at,
      },
      organizations: fullUser.organization_admins.map(oa => oa.organization),
      tables: {
        owned: fullUser.owned_tables,
        roles: fullUser.table_roles,
      },
      recentAssignments: fullUser.guest_assignments,
      recentOrders: fullUser.orders,
      recentActivity: fullUser.activity_logs,
      stats,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update Current User Profile
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = UpdateProfileSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.first_name !== undefined && { first_name: data.first_name }),
        ...(data.last_name !== undefined && { last_name: data.last_name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.sms_opt_in !== undefined && { sms_opt_in: data.sms_opt_in }),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        sms_opt_in: true,
        is_super_admin: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user profile error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
