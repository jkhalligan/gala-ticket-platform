// src/app/api/admin/guests/bulk-assign/route.ts
// POST: Bulk assign multiple guests to a table

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { guest_ids, table_id } = body;

    // Validate input
    if (!Array.isArray(guest_ids) || guest_ids.length === 0) {
      return NextResponse.json(
        { error: 'guest_ids must be a non-empty array' },
        { status: 400 }
      );
    }

    if (table_id !== null && typeof table_id !== 'string') {
      return NextResponse.json(
        { error: 'table_id must be a string or null' },
        { status: 400 }
      );
    }

    // Fetch all guests to validate they exist and get event info
    const guests = await prisma.guestAssignment.findMany({
      where: { id: { in: guest_ids } },
      include: {
        event: { select: { id: true, organization_id: true } },
        table: { select: { id: true, name: true } },
      },
    });

    if (guests.length !== guest_ids.length) {
      return NextResponse.json(
        { error: 'Some guests not found' },
        { status: 404 }
      );
    }

    // Validate all guests belong to the same event
    const eventIds = [...new Set(guests.map(g => g.event_id))];
    if (eventIds.length > 1) {
      return NextResponse.json(
        { error: 'All guests must belong to the same event' },
        { status: 400 }
      );
    }

    const eventId = eventIds[0];
    const organizationId = guests[0].event.organization_id;

    // If assigning to a table, validate it exists and belongs to same event
    let newTable: { id: string; name: string; event: { id: string }; _count: { guest_assignments: number }; capacity: number } | null = null;
    if (table_id !== null) {
      newTable = await prisma.table.findUnique({
        where: { id: table_id },
        select: {
          id: true,
          name: true,
          capacity: true,
          event: { select: { id: true } },
          _count: { select: { guest_assignments: true } },
        },
      });

      if (!newTable) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      if (newTable.event.id !== eventId) {
        return NextResponse.json(
          { error: 'Table and guests must belong to the same event' },
          { status: 400 }
        );
      }

      // Check capacity (warning only, not blocking)
      const currentOccupancy = newTable._count.guest_assignments;
      const newOccupancy = currentOccupancy + guest_ids.length;
      const capacityExceeded = newOccupancy > newTable.capacity;

      if (capacityExceeded) {
        // Return warning but still allow the operation
        return NextResponse.json({
          warning: `This assignment will exceed table capacity (${newOccupancy}/${newTable.capacity} seats)`,
          capacity_exceeded: true,
          current_occupancy: currentOccupancy,
          new_occupancy: newOccupancy,
          capacity: newTable.capacity,
        }, { status: 200 });
      }
    }

    // Perform bulk update
    await prisma.guestAssignment.updateMany({
      where: { id: { in: guest_ids } },
      data: { table_id },
    });

    // Create activity logs for each guest
    const activityLogs = guests.map(guest => {
      const metadata = {
        fromTableId: guest.table_id,
        fromTableName: guest.table?.name || 'Unassigned',
        toTableId: table_id,
        toTableName: newTable?.name || 'Unassigned',
        bulkOperation: true,
        affectedGuestCount: guest_ids.length,
      };

      const action = table_id === null ? "GUEST_REMOVED" as const : "GUEST_REASSIGNED" as const;

      return {
        organization_id: organizationId,
        event_id: eventId,
        actor_id: user.id,
        action,
        entity_type: "GUEST_ASSIGNMENT" as const,
        entity_id: guest.id,
        metadata: metadata as Prisma.InputJsonValue,
      };
    });

    await prisma.activityLog.createMany({
      data: activityLogs,
    });

    return NextResponse.json({
      success: true,
      updated_count: guest_ids.length,
      table: newTable ? { id: newTable.id, name: newTable.name } : null,
    });
  } catch (error) {
    console.error('Failed to bulk assign guests:', error);
    return NextResponse.json(
      { error: 'Failed to bulk assign guests' },
      { status: 500 }
    );
  }
}
