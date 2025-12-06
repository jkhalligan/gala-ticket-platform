// src/app/api/tables/[slug]/guests/route.ts
// =============================================================================
// Table Guests API - List and Add Guests to Table
// =============================================================================
// Phase 5 Update: Added organization_id, tier, and reference_code on guest creation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkTablePermission } from "@/lib/permissions";
import { z } from "zod";
import { 
  generateGuestReferenceCode, 
  getOrganizationIdFromEvent 
} from "@/lib/reference-codes";

// =============================================================================
// Validation Schemas
// =============================================================================

const AddGuestSchema = z.object({
  user_id: z.string().optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  display_name: z.string().optional(),
  dietary_restrictions: z.any().optional(),
  order_id: z.string(), // Required: must specify which order's placeholder seat to claim
}).refine(data => data.user_id || data.email, {
  message: "Either user_id or email is required",
});

// =============================================================================
// GET /api/tables/[slug]/guests - List guests at table
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
      include: { event: true },
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

    // 4. Get guests with user info
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
            quantity: true,
            status: true,
            user_id: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    // 5. Calculate placeholder stats
    const completedOrders = await prisma.order.findMany({
      where: {
        table_id: table.id,
        status: "COMPLETED",
      },
      select: { quantity: true },
    });

    const totalPurchased = completedOrders.reduce((sum, o) => sum + o.quantity, 0);
    const filledSeats = guests.length;
    const placeholderSeats = totalPurchased - filledSeats;

    return NextResponse.json({
      guests,
      stats: {
        total_purchased: totalPurchased,
        filled_seats: filledSeats,
        placeholder_seats: placeholderSeats,
        capacity: table.capacity,
        remaining_capacity: table.capacity - totalPurchased,
      },
    });
  } catch (error) {
    console.error("List table guests error:", error);
    return NextResponse.json({ error: "Failed to list guests" }, { status: 500 });
  }
}

// =============================================================================
// POST /api/tables/[slug]/guests - Add guest to table
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

    // 7. Verify order exists and has placeholder seats
    const order = await prisma.order.findUnique({
      where: { id: data.order_id },
      include: {
        product: { select: { tier: true } },
        _count: { select: { guest_assignments: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.table_id !== table.id) {
      return NextResponse.json(
        { error: "Order does not belong to this table" },
        { status: 400 }
      );
    }

    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Order is not completed" },
        { status: 400 }
      );
    }

    const usedSeats = order._count.guest_assignments;
    if (usedSeats >= order.quantity) {
      return NextResponse.json(
        { error: "No placeholder seats available for this order" },
        { status: 400 }
      );
    }

    // 8. Get organization_id and generate reference_code (Phase 5)
    const organizationId = await getOrganizationIdFromEvent(table.event_id);
    const referenceCode = await generateGuestReferenceCode(organizationId);
    const tier = order.product.tier; // Snapshot tier from product

    // 9. Create guest assignment
    const guestAssignment = await prisma.guestAssignment.create({
      data: {
        event_id: table.event_id,
        organization_id: organizationId,  // Phase 5
        table_id: table.id,
        user_id: guestUser.id,
        order_id: order.id,
        display_name: data.display_name,
        dietary_restrictions: data.dietary_restrictions,
        tier: tier,  // Phase 5: snapshot from product
        reference_code: referenceCode,  // Phase 5
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

    // 10. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: organizationId,
        event_id: table.event_id,
        actor_id: user.id,
        action: "GUEST_ADDED",
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: guestAssignment.id,
        metadata: {
          guest_email: guestUser.email,
          table_slug: table.slug,
          reference_code: referenceCode,
          tier: tier,
        },
      },
    });

    return NextResponse.json({ guest: guestAssignment }, { status: 201 });
  } catch (error) {
    console.error("Add guest error:", error);
    return NextResponse.json({ error: "Failed to add guest" }, { status: 500 });
  }
}