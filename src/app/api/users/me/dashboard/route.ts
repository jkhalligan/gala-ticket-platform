// src/app/api/users/me/dashboard/route.ts
// GET: Fetch complete dashboard data with permissions

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkTablePermission } from '@/lib/permissions';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user's tables (owned + roles)
    const [ownedTables, tableRoles, guestAssignments, orders] = await Promise.all([
      prisma.table.findMany({
        where: { primary_owner_id: user.id },
        include: {
          event: {
            select: { id: true, name: true, event_date: true, venue_name: true },
          },
          guest_assignments: {
            include: {
              user: { select: { id: true, email: true, first_name: true, last_name: true } },
            },
            orderBy: { created_at: 'asc' },
          },
          _count: { select: { guest_assignments: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.tableUserRole.findMany({
        where: { user_id: user.id },
        include: {
          table: {
            include: {
              event: {
                select: { id: true, name: true, event_date: true, venue_name: true },
              },
              guest_assignments: {
                include: {
                  user: { select: { id: true, email: true, first_name: true, last_name: true } },
                },
                orderBy: { created_at: 'asc' },
              },
              _count: { select: { guest_assignments: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.guestAssignment.findMany({
        where: { user_id: user.id },
        include: {
          table: { select: { id: true, name: true, slug: true } },
          event: {
            select: { id: true, name: true, event_date: true, venue_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.order.findMany({
        where: { user_id: user.id, status: 'COMPLETED' },
        include: {
          product: { select: { name: true, kind: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 3,
      }),
    ]);

    // Combine and calculate permissions for all tables
    const tablesWithPermissions = await Promise.all([
      ...ownedTables.map(async (table) => {
        const viewPerm = await checkTablePermission(user.id, table.id, 'view');
        const editPerm = await checkTablePermission(user.id, table.id, 'edit');
        const addGuestPerm = await checkTablePermission(user.id, table.id, 'add_guest');
        const removeGuestPerm = await checkTablePermission(user.id, table.id, 'remove_guest');

        return {
          id: table.id,
          name: table.name,
          slug: table.slug,
          type: table.type,
          capacity: table.capacity,
          filled_seats: table._count.guest_assignments,
          event: table.event,
          guests: table.guest_assignments.map(g => ({
            id: g.id,
            name: g.display_name || `${g.user.first_name || ''} ${g.user.last_name || ''}`.trim() || g.user.email,
            email: g.user.email,
            tier: g.tier,
            checked_in: g.checked_in_at !== null,
            dietary_restrictions: g.dietary_restrictions,
          })),
          permissions: {
            can_view: viewPerm.allowed,
            can_edit: editPerm.allowed,
            can_add_guests: addGuestPerm.allowed,
            can_remove_guests: removeGuestPerm.allowed,
            role: viewPerm.role || 'OWNER',
          },
        };
      }),
      ...tableRoles.map(async (role) => {
        const viewPerm = await checkTablePermission(user.id, role.table.id, 'view');
        const editPerm = await checkTablePermission(user.id, role.table.id, 'edit');
        const addGuestPerm = await checkTablePermission(user.id, role.table.id, 'add_guest');
        const removeGuestPerm = await checkTablePermission(user.id, role.table.id, 'remove_guest');

        return {
          id: role.table.id,
          name: role.table.name,
          slug: role.table.slug,
          type: role.table.type,
          capacity: role.table.capacity,
          filled_seats: role.table._count.guest_assignments,
          event: role.table.event,
          guests: role.table.guest_assignments.map(g => ({
            id: g.id,
            name: g.display_name || `${g.user.first_name || ''} ${g.user.last_name || ''}`.trim() || g.user.email,
            email: g.user.email,
            tier: g.tier,
            checked_in: g.checked_in_at !== null,
            dietary_restrictions: g.dietary_restrictions,
          })),
          permissions: {
            can_view: viewPerm.allowed,
            can_edit: editPerm.allowed,
            can_add_guests: addGuestPerm.allowed,
            can_remove_guests: removeGuestPerm.allowed,
            role: role.role,
          },
        };
      }),
    ]);

    // Format guest assignments
    const formattedAssignments = guestAssignments.map(assignment => ({
      id: assignment.id,
      table: assignment.table,
      event: assignment.event,
      tier: assignment.tier,
      checked_in: assignment.checked_in_at !== null,
      can_edit: true, // Users can edit their own guest details
      can_leave: true, // Users can always edit their own details
    }));

    // Format orders
    const formattedOrders = orders.map(order => ({
      id: order.id,
      amount_cents: order.amount_cents,
      created_at: order.created_at,
      product_name: order.product.name,
      product_kind: order.product.kind,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      tables: tablesWithPermissions,
      guest_assignments: formattedAssignments,
      recent_orders: formattedOrders,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
