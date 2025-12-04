// src/app/api/guests/route.ts
// GET: List guest assignments with filters
// POST: Create a new guest assignment

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { CreateGuestSchema, GuestFiltersSchema } from '@/lib/validation/guests';
import { checkTablePermission } from '@/lib/permissions';
import { Prisma } from '@prisma/client';

// =============================================================================
// GET - List Guest Assignments
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = GuestFiltersSchema.parse(searchParams);

    // Build where clause
    const where: Prisma.GuestAssignmentWhereInput = {};

    if (filters.event_id) {
      where.event_id = filters.event_id;
    }

    if (filters.table_id) {
      where.table_id = filters.table_id;
    }

    if (filters.user_id) {
      where.user_id = filters.user_id;
    }

    if (filters.order_id) {
      where.order_id = filters.order_id;
    }

    if (filters.checked_in !== undefined) {
      where.checked_in_at = filters.checked_in ? { not: null } : null;
    }

    if (filters.search) {
      where.OR = [
        { display_name: { contains: filters.search, mode: 'insensitive' } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
        { user: { first_name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { last_name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    // Non-admins can only see guests at tables they have access to
    if (!user.isAdmin) {
      where.OR = [
        { user_id: user.id }, // Own assignment
        { table: { primary_owner_id: user.id } }, // Tables they own
        { table: { user_roles: { some: { user_id: user.id } } } }, // Tables they have role on
      ];
    }

    // Get total count for pagination
    const total = await prisma.guestAssignment.count({ where });

    // Get guest assignments with related data
    const guests = await prisma.guestAssignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        order: {
          select: {
            id: true,
            user_id: true,
            amount_cents: true,
            status: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return NextResponse.json({
      guests,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error('List guests error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to list guests' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create Guest Assignment
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = CreateGuestSchema.parse(body);

    // Check permission if assigning to a table
    if (data.table_id) {
      const permission = await checkTablePermission(user.id, data.table_id, 'add_guest');
      if (!permission.allowed) {
        return NextResponse.json({ error: permission.reason }, { status: 403 });
      }
    }

    // Verify order exists and has available seats
    const order = await prisma.order.findUnique({
      where: { id: data.order_id },
      include: {
        _count: { select: { guest_assignments: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot assign guest to incomplete order' },
        { status: 400 }
      );
    }

    // Check if order has available seats (placeholder seats)
    const assignedSeats = order._count.guest_assignments;
    if (assignedSeats >= order.quantity) {
      return NextResponse.json(
        { error: 'No available seats on this order' },
        { status: 400 }
      );
    }

    // Get or create user for guest
    let guestUserId = data.user_id;

    if (!guestUserId && data.email) {
      // Find or create user by email
      let guestUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: {
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
          },
        });
      }

      guestUserId = guestUser.id;
    }

    if (!guestUserId) {
      return NextResponse.json(
        { error: 'Either user_id or email must be provided' },
        { status: 400 }
      );
    }

    // Check if user already has an assignment at this table
    if (data.table_id) {
      const existingAssignment = await prisma.guestAssignment.findFirst({
        where: {
          user_id: guestUserId,
          table_id: data.table_id,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          { error: 'User is already assigned to this table' },
          { status: 409 }
        );
      }
    }

    // Create guest assignment
    const guestAssignment = await prisma.guestAssignment.create({
      data: {
        event_id: data.event_id,
        table_id: data.table_id,
        user_id: guestUserId,
        order_id: data.order_id,
        display_name: data.display_name,
        dietary_restrictions: data.dietary_restrictions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        order: {
          select: {
            id: true,
            user_id: true,
          },
        },
      },
    });

    // Log activity
    const event = await prisma.event.findUnique({
      where: { id: data.event_id },
      select: { organization_id: true },
    });

    if (event) {
      await prisma.activityLog.create({
        data: {
          organization_id: event.organization_id,
          event_id: data.event_id,
          actor_id: user.id,
          action: 'GUEST_ADDED',
          entity_type: 'GUEST_ASSIGNMENT',
          entity_id: guestAssignment.id,
          metadata: {
            guest_user_id: guestUserId,
            table_id: data.table_id,
          },
        },
      });
    }

    return NextResponse.json({ guest: guestAssignment }, { status: 201 });
  } catch (error) {
    console.error('Create guest error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create guest' }, { status: 500 });
  }
}
