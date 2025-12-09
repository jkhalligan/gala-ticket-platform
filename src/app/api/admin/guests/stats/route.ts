// src/app/api/admin/guests/stats/route.ts
// GET: Fetch guest statistics for table assignment UI

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('event_id');

    // Build where clause
    const where: any = {};
    if (eventId) {
      where.event_id = eventId;
    }

    // Get total guests count
    const totalGuests = await prisma.guestAssignment.count({ where });

    // Get unassigned guests count
    const unassignedGuests = await prisma.guestAssignment.count({
      where: {
        ...where,
        table_id: null,
      },
    });

    // Get assigned guests count
    const assignedGuests = totalGuests - unassignedGuests;

    // Get guests by tier
    const guestsByTier = await prisma.guestAssignment.groupBy({
      by: ['tier'],
      where,
      _count: true,
    });

    const tierStats = guestsByTier.reduce((acc, item) => {
      acc[item.tier] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Get tables stats if event_id provided
    let tableStats = null;
    if (eventId) {
      const tables = await prisma.table.findMany({
        where: { event_id: eventId },
        include: {
          _count: { select: { guest_assignments: true } },
        },
      });

      const totalTables = tables.length;
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      const totalFilled = tables.reduce((sum, table) => sum + table._count.guest_assignments, 0);
      const tablesAtCapacity = tables.filter(
        table => table._count.guest_assignments >= table.capacity
      ).length;
      const tablesAlmostFull = tables.filter(
        table => {
          const percentFull = (table._count.guest_assignments / table.capacity) * 100;
          return percentFull >= 70 && percentFull < 100;
        }
      ).length;

      tableStats = {
        total_tables: totalTables,
        total_capacity: totalCapacity,
        total_filled: totalFilled,
        available_seats: totalCapacity - totalFilled,
        percentage_filled: totalCapacity > 0 ? Math.round((totalFilled / totalCapacity) * 100) : 0,
        tables_at_capacity: tablesAtCapacity,
        tables_almost_full: tablesAlmostFull,
      };
    }

    return NextResponse.json({
      total_guests: totalGuests,
      assigned_guests: assignedGuests,
      unassigned_guests: unassignedGuests,
      percentage_assigned: totalGuests > 0 ? Math.round((assignedGuests / totalGuests) * 100) : 0,
      guests_by_tier: tierStats,
      table_stats: tableStats,
    });
  } catch (error) {
    console.error('Failed to fetch guest stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guest stats' },
      { status: 500 }
    );
  }
}
