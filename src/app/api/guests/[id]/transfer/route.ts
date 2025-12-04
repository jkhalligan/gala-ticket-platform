// =============================================================================
// Ticket Transfer API Route
// =============================================================================
// POST /api/guests/[id]/transfer  - Transfer a ticket to another person
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkTicketTransferPermission } from "@/lib/permissions";
import { z } from "zod";

// =============================================================================
// Transfer Schema
// =============================================================================

const TransferSchema = z.object({
  // Transfer to existing user by ID or to new/existing user by email
  to_user_id: z.string().optional(),
  to_email: z.string().email().optional(),
  
  // Optional details for new user
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  
  // Optional: keep at same table or remove from table
  keep_table: z.boolean().default(true),
  
  // Optional: transfer display name and dietary info
  transfer_details: z.boolean().default(false),
}).refine(
  (data) => data.to_user_id || data.to_email,
  { message: "Either to_user_id or to_email must be provided" }
);

// =============================================================================
// POST /api/guests/[id]/transfer
// =============================================================================

export async function POST(
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

    // 2. Check transfer permission
    const permission = await checkTicketTransferPermission(user.id, id);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || "Access denied" },
        { status: 403 }
      );
    }

    // 3. Get current guest assignment
    const currentGuest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, first_name: true, last_name: true } },
        table: {
          include: { event: true },
        },
        order: true,
      },
    });

    if (!currentGuest) {
      return NextResponse.json({ error: "Guest assignment not found" }, { status: 404 });
    }

    // 4. Parse request body
    const body = await req.json();
    const parseResult = TransferSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 5. Find or create recipient user
    let recipientUser;
    if (data.to_user_id) {
      recipientUser = await prisma.user.findUnique({
        where: { id: data.to_user_id },
      });
      if (!recipientUser) {
        return NextResponse.json({ error: "Recipient user not found" }, { status: 404 });
      }
    } else if (data.to_email) {
      recipientUser = await prisma.user.findUnique({
        where: { email: data.to_email.toLowerCase() },
      });
      if (!recipientUser) {
        recipientUser = await prisma.user.create({
          data: {
            email: data.to_email.toLowerCase(),
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
          },
        });
      }
    }

    if (!recipientUser) {
      return NextResponse.json({ error: "Could not identify recipient" }, { status: 400 });
    }

    // 6. Check recipient is not already assigned to this table
    if (currentGuest.table_id && data.keep_table) {
      const existingAssignment = await prisma.guestAssignment.findFirst({
        where: {
          table_id: currentGuest.table_id,
          user_id: recipientUser.id,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          { error: "Recipient is already assigned to this table" },
          { status: 409 }
        );
      }
    }

    // 7. Prepare update data
    const updateData: any = {
      user_id: recipientUser.id,
    };

    // Optionally transfer details
    if (!data.transfer_details) {
      // Clear personal details for new recipient
      updateData.display_name = [recipientUser.first_name, recipientUser.last_name]
        .filter(Boolean)
        .join(" ") || null;
      updateData.dietary_restrictions = null;
      updateData.bidder_number = null;
      updateData.auction_registered = false;
      updateData.checked_in_at = null;
    }

    // Optionally remove from table
    if (!data.keep_table) {
      updateData.table_id = null;
    }

    // 8. Perform transfer
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
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // 9. Log activity
    if (currentGuest.table) {
      await prisma.activityLog.create({
        data: {
          organization_id: currentGuest.table.event.organization_id,
          event_id: currentGuest.event_id,
          actor_id: user.id,
          action: "TICKET_TRANSFERRED",
          entity_type: "GUEST_ASSIGNMENT",
          entity_id: id,
          metadata: {
            from_user_id: currentGuest.user_id,
            from_user_email: currentGuest.user.email,
            from_user_name: [currentGuest.user.first_name, currentGuest.user.last_name]
              .filter(Boolean)
              .join(" "),
            to_user_id: recipientUser.id,
            to_user_email: recipientUser.email,
            table_id: currentGuest.table_id,
            table_name: currentGuest.table?.name,
            keep_table: data.keep_table,
            order_id: currentGuest.order_id,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Ticket transferred successfully",
      guest: {
        id: updatedGuest.id,
        user_id: updatedGuest.user_id,
        display_name: updatedGuest.display_name,
        table_id: updatedGuest.table_id,
        user: {
          ...updatedGuest.user,
          full_name: [updatedGuest.user.first_name, updatedGuest.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        table: updatedGuest.table,
      },
      transfer: {
        from: {
          user_id: currentGuest.user_id,
          email: currentGuest.user.email,
          name: [currentGuest.user.first_name, currentGuest.user.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
        to: {
          user_id: recipientUser.id,
          email: recipientUser.email,
          name: [recipientUser.first_name, recipientUser.last_name]
            .filter(Boolean)
            .join(" ") || null,
        },
      },
    });

  } catch (error) {
    console.error("Error transferring ticket:", error);
    return NextResponse.json(
      { error: "Failed to transfer ticket" },
      { status: 500 }
    );
  }
}