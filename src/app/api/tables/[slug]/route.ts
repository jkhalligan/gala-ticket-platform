// =============================================================================
// Table by Slug API Route - Phase 4 Enhanced Version
// =============================================================================
// GET   /api/tables/[slug]  - Get table with full dashboard data
// PATCH /api/tables/[slug]  - Update table
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  checkTablePermission,
  getTablePermissions,
} from "@/lib/permissions";
import { z } from "zod";

// =============================================================================
// Update Schema
// =============================================================================

const TableUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  internal_name: z.string().max(100).optional().nullable(),
  welcome_message: z.string().max(1000).optional().nullable(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(["ACTIVE", "CLOSED", "ARCHIVED"]).optional(),
  custom_total_price_cents: z.number().int().min(0).optional().nullable(),
  seat_price_cents: z.number().int().min(0).optional().nullable(),
  payment_status: z.enum(["NOT_APPLICABLE", "UNPAID", "PAID_OFFLINE", "COMPED"]).optional(),
  payment_notes: z.string().max(500).optional().nullable(),
});

// =============================================================================
// GET /api/tables/[slug]
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Find table by slug (and optionally event_id for disambiguation)
    const where: any = { slug };
    if (eventId) {
      where.event_id = eventId;
    }

    const table = await prisma.table.findFirst({
      where,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            event_date: true,
            organization_id: true,
          },
        },
        primary_owner: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
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
                quantity: true,
                amount_cents: true,
                status: true,
              },
            },
            tags: {
              include: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    color: true,
                  },
                },
              },
            },
          },
          orderBy: { created_at: "asc" },
        },
        orders: {
          where: { status: "COMPLETED" },
          select: {
            id: true,
            user_id: true,
            quantity: true,
            amount_cents: true,
            status: true,
            created_at: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check view permission
    const viewPermission = await checkTablePermission(user.id, table.id, "view");
    if (!viewPermission.allowed) {
      return NextResponse.json(
        { error: viewPermission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Get user's permissions for this table
    const permissions = await getTablePermissions(user.id, table.id);

    // 5. Calculate seat statistics
    const stats = calculateTableStats(table);

    // 6. Format guest assignments
    const guests = table.guest_assignments.map((ga) => ({
      id: ga.id,
      user_id: ga.user_id,
      order_id: ga.order_id,
      display_name: ga.display_name,
      dietary_restrictions: ga.dietary_restrictions,
      bidder_number: ga.bidder_number,
      auction_registered: ga.auction_registered,
      checked_in_at: ga.checked_in_at?.toISOString() || null,
      created_at: ga.created_at.toISOString(),
      // User info
      user: {
        id: ga.user.id,
        email: ga.user.email,
        first_name: ga.user.first_name,
        last_name: ga.user.last_name,
        phone: ga.user.phone,
        full_name: [ga.user.first_name, ga.user.last_name].filter(Boolean).join(" ") || null,
      },
      // Order info (for determining if self-pay)
      is_self_pay: ga.order.user_id === ga.user_id,
      order: {
        id: ga.order.id,
        buyer_id: ga.order.user_id,
        amount_cents: ga.order.amount_cents,
      },
      // Tags
      tags: ga.tags.map((t) => t.tag),
    }));

    // 7. Format roles
    const roles = [
      // Primary owner is always OWNER
      {
        user_id: table.primary_owner_id,
        role: "OWNER" as const,
        user: {
          id: table.primary_owner.id,
          email: table.primary_owner.email,
          first_name: table.primary_owner.first_name,
          last_name: table.primary_owner.last_name,
          full_name: [table.primary_owner.first_name, table.primary_owner.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
      },
      // Additional roles from TableUserRole
      ...table.user_roles
        .filter((r) => r.user_id !== table.primary_owner_id || r.role !== "OWNER")
        .map((r) => ({
          user_id: r.user_id,
          role: r.role,
          user: {
            id: r.user.id,
            email: r.user.email,
            first_name: r.user.first_name,
            last_name: r.user.last_name,
            full_name: [r.user.first_name, r.user.last_name].filter(Boolean).join(" ") || null,
          },
        })),
    ];

    // 8. Build response
    return NextResponse.json({
      table: {
        id: table.id,
        event_id: table.event_id,
        primary_owner_id: table.primary_owner_id,
        name: table.name,
        internal_name: table.internal_name,
        slug: table.slug,
        type: table.type,
        capacity: table.capacity,
        status: table.status,
        custom_total_price_cents: table.custom_total_price_cents,
        seat_price_cents: table.seat_price_cents,
        payment_status: table.payment_status,
        payment_notes: table.payment_notes,
        created_at: table.created_at.toISOString(),
        updated_at: table.updated_at.toISOString(),
        // Event
        event: {
          id: table.event.id,
          name: table.event.name,
          event_date: table.event.event_date?.toISOString() || null,
        },
        // Owner
        primary_owner: {
          id: table.primary_owner.id,
          email: table.primary_owner.email,
          first_name: table.primary_owner.first_name,
          last_name: table.primary_owner.last_name,
          full_name: [table.primary_owner.first_name, table.primary_owner.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        // Tags
        tags: table.tags.map((t) => t.tag),
      },
      // Statistics
      stats,
      // Guest assignments
      guests,
      // Roles
      roles,
      // User's permissions
      permissions: {
        role: permissions.role,
        can_view: permissions.permissions.view,
        can_edit: permissions.permissions.edit,
        can_add_guest: permissions.permissions.add_guest,
        can_remove_guest: permissions.permissions.remove_guest,
        can_edit_guest: permissions.permissions.edit_guest,
        can_manage_roles: permissions.permissions.manage_roles,
        can_delete: permissions.permissions.delete,
      },
    });

  } catch (error) {
    console.error("Error fetching table:", error);
    return NextResponse.json(
      { error: "Failed to fetch table" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/tables/[slug]
// =============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Find table
    const table = await prisma.table.findFirst({
      where: { slug },
      include: { event: true },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check edit permission
    const editPermission = await checkTablePermission(user.id, table.id, "edit");
    if (!editPermission.allowed) {
      return NextResponse.json(
        { error: editPermission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Parse and validate update data
    const body = await req.json();
    const parseResult = TableUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // 5. Validate slug uniqueness if changing
    if (updateData.slug && updateData.slug !== table.slug) {
      const existingWithSlug = await prisma.table.findFirst({
        where: {
          slug: updateData.slug,
          event_id: table.event_id,
          id: { not: table.id },
        },
      });

      if (existingWithSlug) {
        return NextResponse.json(
          { error: "This URL is already taken. Please choose a different one." },
          { status: 400 }
        );
      }
    }

    // 6. Update table
    const updatedTable = await prisma.table.update({
      where: { id: table.id },
      data: updateData,
    });

    // 7. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event_id,
        actor_id: user.id,
        action: "TABLE_UPDATED",
        entity_type: "TABLE",
        entity_id: table.id,
        metadata: {
          changes: updateData,
          previous_values: {
            name: table.name,
            status: table.status,
            capacity: table.capacity,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      table: {
        id: updatedTable.id,
        name: updatedTable.name,
        internal_name: updatedTable.internal_name,
        slug: updatedTable.slug,
        welcome_message: updatedTable.welcome_message,
        type: updatedTable.type,
        capacity: updatedTable.capacity,
        status: updatedTable.status,
        updated_at: updatedTable.updated_at.toISOString(),
      },
      // Include new slug if it changed (for redirect)
      slug_changed: updateData.slug && updateData.slug !== slug,
      new_slug: updateData.slug || slug,
    });

  } catch (error) {
    console.error("Error updating table:", error);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

interface TableWithOrders {
  capacity: number;
  orders: Array<{ quantity: number }>;
  guest_assignments: Array<{ id: string }>;
}

function calculateTableStats(table: TableWithOrders) {
  // Total seats purchased (from completed orders)
  const totalPurchased = table.orders.reduce((sum, o) => sum + o.quantity, 0);

  // Seats with actual guest assignments
  const filledSeats = table.guest_assignments.length;

  // Placeholder seats (purchased but not yet assigned)
  const placeholderSeats = Math.max(0, totalPurchased - filledSeats);

  // Remaining capacity (can still be purchased)
  const remainingCapacity = Math.max(0, table.capacity - totalPurchased);

  // Is the table at capacity?
  const isFull = remainingCapacity <= 0;

  // Is the table fully assigned? (all purchased seats have guests)
  const isFullyAssigned = placeholderSeats <= 0 && filledSeats >= totalPurchased;

  return {
    capacity: table.capacity,
    total_purchased: totalPurchased,
    filled_seats: filledSeats,
    placeholder_seats: placeholderSeats,
    remaining_capacity: remainingCapacity,
    is_full: isFull,
    is_fully_assigned: isFullyAssigned,
    fill_percentage: table.capacity > 0 
      ? Math.round((totalPurchased / table.capacity) * 100) 
      : 0,
    assignment_percentage: totalPurchased > 0 
      ? Math.round((filledSeats / totalPurchased) * 100) 
      : 0,
  };
}