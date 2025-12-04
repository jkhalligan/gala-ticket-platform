// src/app/api/guests/[id]/route.ts
// GET: Get guest assignment by ID
// PATCH: Update guest assignment
// DELETE: Remove guest assignment

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { UpdateGuestSchema } from '@/lib/validation/guests';
import { 
  checkGuestViewPermission, 
  checkTablePermission,
  checkRemoveGuestPermission,
  checkSelfEditPermission,
} from '@/lib/permissions';

// =============================================================================
// GET - Get Guest Assignment by ID
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check permission
    const permission = await checkGuestViewPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    const guest = await prisma.guestAssignment.findUnique({
      where: { id },
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
            capacity: true,
          },
        },
        order: {
          select: {
            id: true,
            user_id: true,
            quantity: true,
            amount_cents: true,
            status: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            event_date: true,
            venue_name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // Check if this is the user's own record
    const isOwnRecord = guest.user_id === user.id;

    return NextResponse.json({
      guest,
      currentUser: {
        isOwnRecord,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error('Get guest error:', error);
    return NextResponse.json({ error: 'Failed to get guest' }, { status: 500 });
  }
}

// =============================================================================
// PATCH - Update Guest Assignment
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const guest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        table: {
          include: {
            event: { select: { organization_id: true } },
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = UpdateGuestSchema.parse(body);

    // Check permissions based on what's being updated
    const isOwnRecord = guest.user_id === user.id;
    
    // Self-editable fields (dietary_restrictions, auction_registered for own record)
    const selfEditableFields = ['dietary_restrictions', 'auction_registered', 'display_name'];
    const requestedFields = Object.keys(data).filter(k => data[k as keyof typeof data] !== undefined);
    const onlySelfEditableFields = requestedFields.every(f => selfEditableFields.includes(f));

    if (isOwnRecord && onlySelfEditableFields) {
      // User can edit their own basic info
      const selfPermission = await checkSelfEditPermission(user.id, id);
      if (!selfPermission.allowed) {
        return NextResponse.json({ error: selfPermission.reason }, { status: 403 });
      }
    } else if (guest.table_id) {
      // Need table edit permission for other fields
      const permission = await checkTablePermission(user.id, guest.table_id, 'edit_guest');
      if (!permission.allowed) {
        return NextResponse.json({ error: permission.reason }, { status: 403 });
      }
    } else if (!user.isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // If changing table, check permission on new table
    if (data.table_id !== undefined && data.table_id !== guest.table_id) {
      if (data.table_id) {
        // Check if target table has capacity
        const targetTable = await prisma.table.findUnique({
          where: { id: data.table_id },
          include: {
            _count: { select: { guest_assignments: true } },
          },
        });

        if (!targetTable) {
          return NextResponse.json({ error: 'Target table not found' }, { status: 404 });
        }

        if (targetTable._count.guest_assignments >= targetTable.capacity) {
          return NextResponse.json({ error: 'Target table is full' }, { status: 400 });
        }

        // Only admins can reassign between tables
        if (!user.isAdmin) {
          return NextResponse.json(
            { error: 'Only admins can reassign guests between tables' },
            { status: 403 }
          );
        }
      }
    }

    // Update the guest assignment
    const updatedGuest = await prisma.guestAssignment.update({
      where: { id },
      data: {
        ...(data.table_id !== undefined && { table_id: data.table_id }),
        ...(data.display_name !== undefined && { display_name: data.display_name }),
        ...(data.dietary_restrictions !== undefined && { dietary_restrictions: data.dietary_restrictions }),
        ...(data.bidder_number !== undefined && { bidder_number: data.bidder_number }),
        ...(data.auction_registered !== undefined && { auction_registered: data.auction_registered }),
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
      },
    });

    // Log activity
    if (guest.table?.event?.organization_id) {
      await prisma.activityLog.create({
        data: {
          organization_id: guest.table.event.organization_id,
          event_id: guest.event_id,
          actor_id: user.id,
          action: data.table_id !== undefined && data.table_id !== guest.table_id 
            ? 'GUEST_REASSIGNED' 
            : 'GUEST_UPDATED',
          entity_type: 'GUEST_ASSIGNMENT',
          entity_id: guest.id,
          metadata: { 
            changes: data,
            previous_table_id: guest.table_id,
          },
        },
      });
    }

    return NextResponse.json({ guest: updatedGuest });
  } catch (error) {
    console.error('Update guest error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update guest' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Remove Guest Assignment
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check permission (complex rules for CAPTAIN_PAYG tables)
    const permission = await checkRemoveGuestPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason }, { status: 403 });
    }

    const guest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        table: {
          include: {
            event: { select: { organization_id: true } },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // Delete the guest assignment
    await prisma.guestAssignment.delete({
      where: { id },
    });

    // Log activity
    if (guest.table?.event?.organization_id) {
      await prisma.activityLog.create({
        data: {
          organization_id: guest.table.event.organization_id,
          event_id: guest.event_id,
          actor_id: user.id,
          action: 'GUEST_REMOVED',
          entity_type: 'GUEST_ASSIGNMENT',
          entity_id: guest.id,
          metadata: {
            removed_user_id: guest.user_id,
            removed_user_email: guest.user?.email,
            table_id: guest.table_id,
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete guest error:', error);
    return NextResponse.json({ error: 'Failed to delete guest' }, { status: 500 });
  }
}
