// =============================================================================
// Table Guests API Route
// =============================================================================
// GET  /api/tables/[slug]/guests  - List guests at this table
// POST /api/tables/[slug]/guests  - Add a guest to this table (claim placeholder seat)
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkTablePermission } from "@/lib/permissions";
import { z } from "zod";

// =============================================================================
// Add Guest Schema
// =============================================================================

const AddGuestSchema = z.object({
  // Either provide user_id of existing user, or email to create/find user
  user_id: z.string().optional(),
  email: z.string().email().optional(),
  
  // Optional user details (used when creating new user)
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  
  // Guest assignment details
  display_name: z.string().max(200).optional(),
  dietary_restrictions: z.any().optional(), // JSON
  
  // Which order to claim the seat from (optional - will find available if not specified)
  order_id: z.string().optional(),
}).refine(
  (data) => data.user_id || data.email,
  { message: "Either user_id or email must be provided" }
);

// =============================================================================
// GET /api/tables/[slug]/guests
// =============================================================================

export async function GET(
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
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // 3. Check view permission
    const permission = await checkTablePermission(user.id, table.id, "view");
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Fetch guests
    const guests = await prisma.guestAssignment.findMany({
      where: { table_id: table.id },
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
          },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { created_at: "asc" },
    });

    // 5. Calculate available placeholder seats
    const orders = await prisma.order.findMany({
      where: { table_id: table.id, status: "COMPLETED" },
      select: { id: true, user_id: true, quantity: true },
    });

    const totalPurchased = orders.reduce((sum, o) => sum + o.quantity, 0);
    const assignedSeats = guests.length;
    const placeholderSeats = Math.max(0, totalPurchased - assignedSeats);

    return NextResponse.json({
      table_id: table.id,
      table_name: table.name,
      guests: guests.map((g) => ({
        id: g.id,
        user_id: g.user_id,
        order_id: g.order_id,
        display_name: g.display_name,
        dietary_restrictions: g.dietary_restrictions,
        bidder_number: g.bidder_number,
        auction_registered: g.auction_registered,
        checked_in_at: g.checked_in_at?.toISOString() || null,
        created_at: g.created_at.toISOString(),
        user: {
          ...g.user,
          full_name: [g.user.first_name, g.user.last_name].filter(Boolean).join(" ") || null,
        },
        is_self_pay: g.order.user_id === g.user_id,
        tags: g.tags.map((t) => t.tag),
      })),
      stats: {
        total_guests: guests.length,
        placeholder_seats: placeholderSeats,
        can_add_more: placeholderSeats > 0,
      },
    });

  } catch (error) {
    console.error("Error listing table guests:", error);
    return NextResponse.json(
      { error: "Failed to list guests" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/tables/[slug]/guests
// =============================================================================

export async function POST(
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

    // 3. Check add_guest permission
    const permission = await checkTablePermission(user.id, table.id, "add_guest");
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 4. Parse request body
    const body = await req.json();
    const parseResult = AddGuestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 5. Find or create guest user
    let guestUser;
    if (data.user_id) {
      guestUser = await prisma.user.findUnique({
        where: { id: data.user_id },
      });
      if (!guestUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    } else if (data.email) {
      guestUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
          },
        });
      }
    }

    if (!guestUser) {
      return NextResponse.json({ error: "Could not identify guest user" }, { status: 400 });
    }

    // 6. Check if user is already assigned to this table
    const existingAssignment = await prisma.guestAssignment.findFirst({
      where: { table_id: table.id, user_id: guestUser.id },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "User is already assigned to this table" },
        { status: 409 }
      );
    }

    // 7. Find an order with available placeholder seats
    const orders = await prisma.order.findMany({
      where: { table_id: table.id, status: "COMPLETED" },
      include: {
        guest_assignments: { select: { id: true } },
      },
      orderBy: { created_at: "asc" },
    });

    let targetOrder;
    if (data.order_id) {
      // Use specified order
      targetOrder = orders.find((o) => o.id === data.order_id);
      if (!targetOrder) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (targetOrder.guest_assignments.length >= targetOrder.quantity) {
        return NextResponse.json(
          { error: "No available seats in this order" },
          { status: 400 }
        );
      }
    } else {
      // Find first order with available seats
      targetOrder = orders.find(
        (o) => o.guest_assignments.length < o.quantity
      );
    }

    if (!targetOrder) {
      return NextResponse.json(
        { error: "No available seats at this table" },
        { status: 400 }
      );
    }

    // 8. Create guest assignment
    const guestAssignment = await prisma.guestAssignment.create({
      data: {
        event_id: table.event_id,
        table_id: table.id,
        user_id: guestUser.id,
        order_id: targetOrder.id,
        display_name: data.display_name || 
          [guestUser.first_name, guestUser.last_name].filter(Boolean).join(" ") || 
          null,
        dietary_restrictions: data.dietary_restrictions || null,
      },
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
    });

    // 9. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event_id,
        actor_id: user.id,
        action: "GUEST_ADDED",
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: guestAssignment.id,
        metadata: {
          table_id: table.id,
          table_name: table.name,
          guest_email: guestUser.email,
          order_id: targetOrder.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      guest: {
        id: guestAssignment.id,
        user_id: guestAssignment.user_id,
        order_id: guestAssignment.order_id,
        display_name: guestAssignment.display_name,
        user: {
          ...guestAssignment.user,
          full_name: [guestAssignment.user.first_name, guestAssignment.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        created_at: guestAssignment.created_at.toISOString(),
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error adding guest:", error);
    return NextResponse.json(
      { error: "Failed to add guest" },
      { status: 500 }
    );
  }
}