import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/admin/guests/[id] - Fetch a single guest by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

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
        event: {
          select: {
            id: true,
            name: true,
            event_date: true,
            organization_id: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            amount_cents: true,
            created_at: true,
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Fetch activity log for this guest
    const activityLog = await prisma.activityLog.findMany({
      where: {
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: id,
      },
      include: {
        actor: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: 50,
    });

    const formattedGuest = {
      id: guest.id,
      userId: guest.user_id,
      displayName: guest.display_name,
      tier: guest.tier,
      checkedInAt: guest.checked_in_at?.toISOString() || null,
      referenceCode: guest.reference_code,
      bidderNumber: guest.bidder_number,
      dietaryRestrictions: guest.dietary_restrictions as string[] | null,
      auctionRegistered: guest.auction_registered,
      tableId: guest.table_id,
      eventId: guest.event_id,
      createdAt: guest.created_at.toISOString(),
      updatedAt: guest.updated_at.toISOString(),
      user: {
        id: guest.user.id,
        email: guest.user.email,
        firstName: guest.user.first_name,
        lastName: guest.user.last_name,
        phone: guest.user.phone,
      },
      table: guest.table
        ? {
            id: guest.table.id,
            name: guest.table.name,
            slug: guest.table.slug,
            type: guest.table.type,
          }
        : null,
      event: {
        id: guest.event.id,
        name: guest.event.name,
        eventDate: guest.event.event_date.toISOString(),
      },
      order: {
        id: guest.order.id,
        status: guest.order.status,
        amountCents: guest.order.amount_cents,
        createdAt: guest.order.created_at.toISOString(),
      },
    };

    const formattedActivityLog = activityLog.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actorEmail: entry.actor?.email || null,
      createdAt: entry.created_at.toISOString(),
      metadata: entry.metadata as Record<string, unknown> | null,
    }));

    return NextResponse.json({
      guest: formattedGuest,
      activityLog: formattedActivityLog,
    });
  } catch (error) {
    console.error("Failed to fetch guest:", error);
    return NextResponse.json(
      { error: "Failed to fetch guest" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/guests/[id] - Update a guest
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Find the existing guest
    const existingGuest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
          },
        },
        table: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existingGuest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      displayName,
      tier,
      tableId,
      bidderNumber,
      dietaryRestrictions,
      auctionRegistered,
    } = body;

    // Track changes for activity log
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (displayName !== existingGuest.display_name) {
      changes.displayName = { from: existingGuest.display_name, to: displayName };
    }
    if (tier !== existingGuest.tier) {
      changes.tier = { from: existingGuest.tier, to: tier };
    }
    if (tableId !== existingGuest.table_id) {
      changes.tableId = { from: existingGuest.table_id, to: tableId };
    }
    if (bidderNumber !== existingGuest.bidder_number) {
      changes.bidderNumber = { from: existingGuest.bidder_number, to: bidderNumber };
    }
    if (auctionRegistered !== existingGuest.auction_registered) {
      changes.auctionRegistered = { from: existingGuest.auction_registered, to: auctionRegistered };
    }

    // Verify new table exists and has capacity (if changing table)
    if (tableId && tableId !== existingGuest.table_id) {
      const newTable = await prisma.table.findUnique({
        where: { id: tableId },
        include: {
          _count: {
            select: { guest_assignments: true },
          },
        },
      });

      if (!newTable) {
        return NextResponse.json(
          { error: "Selected table not found" },
          { status: 400 }
        );
      }

      if (newTable._count.guest_assignments >= newTable.capacity) {
        return NextResponse.json(
          { error: "Selected table is at full capacity" },
          { status: 400 }
        );
      }
    }

    // Update the guest
    const updatedGuest = await prisma.guestAssignment.update({
      where: { id },
      data: {
        display_name: displayName || null,
        tier: ["STANDARD", "VIP", "VVIP"].includes(tier) ? tier : existingGuest.tier,
        table_id: tableId || null,
        bidder_number: bidderNumber || null,
        dietary_restrictions: dietaryRestrictions || null,
        auction_registered: typeof auctionRegistered === "boolean" ? auctionRegistered : existingGuest.auction_registered,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        table: {
          select: {
            name: true,
          },
        },
      },
    });

    // Determine the action type
    let action: "GUEST_UPDATED" | "GUEST_REASSIGNED" = "GUEST_UPDATED";
    let metadata: Record<string, unknown> = { changes };

    if (tableId !== existingGuest.table_id) {
      action = "GUEST_REASSIGNED";
      metadata = {
        fromTable: existingGuest.table?.name || "Unassigned",
        toTable: updatedGuest.table?.name || "Unassigned",
        fromTableId: existingGuest.table_id,
        toTableId: tableId,
      };
    }

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingGuest.event.organization_id,
        event_id: existingGuest.event_id,
        actor_id: user.id,
        action,
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: id,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      guest: {
        id: updatedGuest.id,
        displayName: updatedGuest.display_name,
        tier: updatedGuest.tier,
        tableId: updatedGuest.table_id,
        userEmail: updatedGuest.user.email,
      },
    });
  } catch (error) {
    console.error("Failed to update guest:", error);
    return NextResponse.json(
      { error: "Failed to update guest" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/guests/[id] - Remove a guest assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Find the existing guest
    const existingGuest = await prisma.guestAssignment.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
          },
        },
        user: {
          select: {
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        table: {
          select: {
            name: true,
          },
        },
        order: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!existingGuest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Check if guest has a completed order (can't delete without refund)
    if (existingGuest.order.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot remove guest with completed payment. Please process a refund first." },
        { status: 400 }
      );
    }

    // Delete the guest assignment
    await prisma.guestAssignment.delete({
      where: { id },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingGuest.event.organization_id,
        event_id: existingGuest.event_id,
        actor_id: user.id,
        action: "GUEST_REMOVED",
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: id,
        metadata: {
          guestEmail: existingGuest.user.email,
          guestName: existingGuest.user.first_name
            ? `${existingGuest.user.first_name} ${existingGuest.user.last_name || ""}`.trim()
            : existingGuest.user.email,
          tableName: existingGuest.table?.name || "Unassigned",
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete guest:", error);
    return NextResponse.json(
      { error: "Failed to delete guest" },
      { status: 500 }
    );
  }
}
