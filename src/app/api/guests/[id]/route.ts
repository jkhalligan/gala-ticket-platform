// =============================================================================
// Guest by ID API Route - Phase 4 Enhanced Version
// =============================================================================
// GET    /api/guests/[id]  - Get guest details
// PATCH  /api/guests/[id]  - Update guest info
// DELETE /api/guests/[id]  - Remove guest from table
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  checkGuestViewPermission,
  checkEditGuestPermission,
  checkRemoveGuestPermission,
} from "@/lib/permissions";
import { z } from "zod";

// =============================================================================
// Update Schema
// =============================================================================

const GuestUpdateSchema = z.object({
  display_name: z.string().max(200).optional().nullable(),
  dietary_restrictions: z.any().optional().nullable(), // JSON
  bidder_number: z.string().max(50).optional().nullable(),
  auction_registered: z.boolean().optional(),
});

// =============================================================================
// GET /api/guests/[id]
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check view permission
    const permission = await checkGuestViewPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 3. Fetch guest with relations
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
          },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    return NextResponse.json({
      guest: {
        id: guest.id,
        event_id: guest.event_id,
        table_id: guest.table_id,
        user_id: guest.user_id,
        order_id: guest.order_id,
        display_name: guest.display_name,
        dietary_restrictions: guest.dietary_restrictions,
        bidder_number: guest.bidder_number,
        auction_registered: guest.auction_registered,
        checked_in_at: guest.checked_in_at?.toISOString() || null,
        qr_code_token: guest.qr_code_token,
        created_at: guest.created_at.toISOString(),
        updated_at: guest.updated_at.toISOString(),
        // User info
        user: {
          ...guest.user,
          full_name: [guest.user.first_name, guest.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        // Table info
        table: guest.table,
        // Event info
        event: guest.event,
        // Order info
        order: {
          ...guest.order,
          is_buyer: guest.order.user_id === guest.user_id,
        },
        // Tags
        tags: guest.tags.map((t) => t.tag),
        // Derived fields
        is_self_pay: guest.order.user_id === guest.user_id,
      },
      // Include user's permission level
      viewer_role: permission.role,
    });

  } catch (error) {
    console.error("Error fetching guest:", error);
    return NextResponse.json(
      { error: "Failed to fetch guest" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/guests/[id]
// =============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check edit permission
    const permission = await checkEditGuestPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 3. Get existing guest
    const existingGuest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        table: {
          include: { event: true },
        },
      },
    });

    if (!existingGuest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // 4. Parse and validate update data
    const body = await req.json();
    const parseResult = GuestUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // 5. Update guest
    const updatedGuest = await prisma.guestAssignment.update({
      where: { id },
      data: updateData,
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

    // 6. Log activity
    if (existingGuest.table) {
      await prisma.activityLog.create({
        data: {
          organization_id: existingGuest.table.event.organization_id,
          event_id: existingGuest.event_id,
          actor_id: user.id,
          action: "GUEST_UPDATED",
          entity_type: "GUEST_ASSIGNMENT",
          entity_id: id,
          metadata: {
            changes: updateData,
            table_id: existingGuest.table_id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      guest: {
        id: updatedGuest.id,
        display_name: updatedGuest.display_name,
        dietary_restrictions: updatedGuest.dietary_restrictions,
        bidder_number: updatedGuest.bidder_number,
        auction_registered: updatedGuest.auction_registered,
        updated_at: updatedGuest.updated_at.toISOString(),
        user: {
          ...updatedGuest.user,
          full_name: [updatedGuest.user.first_name, updatedGuest.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
      },
    });

  } catch (error) {
    console.error("Error updating guest:", error);
    return NextResponse.json(
      { error: "Failed to update guest" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/guests/[id]
// =============================================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check remove permission (includes CAPTAIN_PAYG special rules)
    const permission = await checkRemoveGuestPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 3. Get guest before deletion for logging
    const guest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, first_name: true, last_name: true } },
        table: {
          include: { event: true },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // 4. Delete guest assignment
    await prisma.guestAssignment.delete({
      where: { id },
    });

    // 5. Log activity
    if (guest.table) {
      await prisma.activityLog.create({
        data: {
          organization_id: guest.table.event.organization_id,
          event_id: guest.event_id,
          actor_id: user.id,
          action: "GUEST_REMOVED",
          entity_type: "GUEST_ASSIGNMENT",
          entity_id: id,
          metadata: {
            guest_email: guest.user.email,
            guest_name: [guest.user.first_name, guest.user.last_name]
              .filter(Boolean)
              .join(" "),
            table_id: guest.table_id,
            table_name: guest.table.name,
            order_id: guest.order_id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Guest removed from table",
      // Note: The order still exists - this just removes the assignment
      // The seat becomes a "placeholder" again
    });

  } catch (error) {
    console.error("Error removing guest:", error);
    return NextResponse.json(
      { error: "Failed to remove guest" },
      { status: 500 }
    );
  }
}