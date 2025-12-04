// src/app/api/tables/[slug]/route.ts
// GET: Get table by slug
// PATCH: Update table

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { UpdateTableSchema } from '@/lib/validation/tables';
import { checkTablePermission } from '@/lib/permissions';

// =============================================================================
// GET - Get Table by Slug
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;

    // Get event_id from query params (required for unique lookup)
    const eventId = request.nextUrl.searchParams.get('event_id');

    let table;

    if (eventId) {
      // Lookup by event_id + slug (unique)
      table = await prisma.table.findUnique({
        where: {
          event_id_slug: {
            event_id: eventId,
            slug,
          },
        },
        include: {
          primary_owner: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              organization_id: true,
            },
          },
          user_roles: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          guest_assignments: {
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
              order: {
                select: {
                  id: true,
                  user_id: true,
                  amount_cents: true,
                  status: true,
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
          orders: {
            select: {
              id: true,
              user_id: true,
              quantity: true,
              amount_cents: true,
              status: true,
              _count: {
                select: { guest_assignments: true },
              },
            },
            where: {
              status: { in: ['COMPLETED', 'PENDING'] },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
    } else {
      // Fallback: search by slug alone (may return wrong table if duplicates)
      table = await prisma.table.findFirst({
        where: { slug },
        include: {
          primary_owner: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
              organization_id: true,
            },
          },
          user_roles: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          guest_assignments: {
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
              order: {
                select: {
                  id: true,
                  user_id: true,
                  amount_cents: true,
                  status: true,
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
          orders: {
            select: {
              id: true,
              user_id: true,
              quantity: true,
              amount_cents: true,
              status: true,
              _count: {
                select: { guest_assignments: true },
              },
            },
            where: {
              status: { in: ['COMPLETED', 'PENDING'] },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
    }

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Check view permission
    const permission = await checkTablePermission(user.id, table.id, 'view');
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    // Calculate seat statistics
    const totalPurchasedSeats = table.orders.reduce((sum, order) => sum + order.quantity, 0);
    const filledSeats = table.guest_assignments.length;
    const placeholderSeats = totalPurchasedSeats - filledSeats;
    const remainingCapacity = table.capacity - totalPurchasedSeats;

    // Get user's role for this table
    const userRole = table.user_roles.find((r) => r.user_id === user.id)?.role;
    const isPrimaryOwner = table.primary_owner_id === user.id;

    return NextResponse.json({
      table: {
        ...table,
        stats: {
          capacity: table.capacity,
          totalPurchasedSeats,
          filledSeats,
          placeholderSeats,
          remainingCapacity,
        },
        currentUser: {
          role: userRole || (isPrimaryOwner ? 'OWNER' : null),
          isPrimaryOwner,
          isAdmin: user.isAdmin,
        },
      },
    });
  } catch (error) {
    console.error('Get table error:', error);
    return NextResponse.json({ error: 'Failed to get table' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update Table
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const eventId = request.nextUrl.searchParams.get('event_id');

    // Find the table
    let table;
    if (eventId) {
      table = await prisma.table.findUnique({
        where: {
          event_id_slug: {
            event_id: eventId,
            slug,
          },
        },
        include: {
          event: { select: { organization_id: true } },
        },
      });
    } else {
      table = await prisma.table.findFirst({
        where: { slug },
        include: {
          event: { select: { organization_id: true } },
        },
      });
    }

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Check edit permission
    const permission = await checkTablePermission(user.id, table.id, 'edit');
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    const body = await request.json();
    const data = UpdateTableSchema.parse(body);

    // If changing slug, check for conflicts
    if (data.slug && data.slug !== table.slug) {
      const existingTable = await prisma.table.findUnique({
        where: {
          event_id_slug: {
            event_id: table.event_id,
            slug: data.slug,
          },
        },
      });

      if (existingTable) {
        return NextResponse.json(
          { error: 'A table with this slug already exists' },
          { status: 409 }
        );
      }
    }

    // Update the table
    const updatedTable = await prisma.table.update({
      where: { id: table.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.welcome_message !== undefined && { welcome_message: data.welcome_message }),
        ...(data.internal_name !== undefined && { internal_name: data.internal_name }),
        ...(data.table_number !== undefined && { table_number: data.table_number }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.custom_total_price_cents !== undefined && { custom_total_price_cents: data.custom_total_price_cents }),
        ...(data.seat_price_cents !== undefined && { seat_price_cents: data.seat_price_cents }),
        ...(data.payment_status !== undefined && { payment_status: data.payment_status }),
        ...(data.payment_notes !== undefined && { payment_notes: data.payment_notes }),
      },
      include: {
        primary_owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event_id,
        actor_id: user.id,
        action: 'TABLE_UPDATED',
        entity_type: 'TABLE',
        entity_id: table.id,
        metadata: { changes: data },
      },
    });

    return NextResponse.json({ table: updatedTable });
  } catch (error) {
    console.error('Update table error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
  }
}
