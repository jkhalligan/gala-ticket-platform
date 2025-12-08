import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/admin/tables/[slug] - Fetch a single table by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;

    const table = await prisma.table.findFirst({
      where: { slug },
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
        guest_assignments: {
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
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const formattedTable = {
      id: table.id,
      name: table.name,
      slug: table.slug,
      type: table.type,
      status: table.status,
      capacity: table.capacity,
      tableNumber: table.table_number,
      internalName: table.internal_name,
      welcomeMessage: table.welcome_message,
      referenceCode: table.reference_code,
      eventId: table.event_id,
      createdAt: table.created_at.toISOString(),
      updatedAt: table.updated_at.toISOString(),
      event: {
        id: table.event.id,
        name: table.event.name,
        eventDate: table.event.event_date.toISOString(),
      },
      primaryOwner: {
        id: table.primary_owner.id,
        email: table.primary_owner.email,
        firstName: table.primary_owner.first_name,
        lastName: table.primary_owner.last_name,
      },
      guests: table.guest_assignments.map((ga) => ({
        id: ga.id,
        userId: ga.user_id,
        displayName: ga.display_name,
        userEmail: ga.user.email,
        userFirstName: ga.user.first_name,
        userLastName: ga.user.last_name,
        checkedInAt: ga.checked_in_at?.toISOString() || null,
        tier: ga.tier,
      })),
    };

    return NextResponse.json({ table: formattedTable });
  } catch (error) {
    console.error("Failed to fetch table:", error);
    return NextResponse.json(
      { error: "Failed to fetch table" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/tables/[slug] - Update a table
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;

    // Find the existing table
    const existingTable = await prisma.table.findFirst({
      where: { slug },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
          },
        },
      },
    });

    if (!existingTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      slug: newSlug,
      type,
      status,
      capacity,
      tableNumber,
      internalName,
      welcomeMessage,
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    // Check if new slug is unique (if changed)
    if (newSlug && newSlug !== slug) {
      const slugExists = await prisma.table.findFirst({
        where: {
          slug: newSlug,
          event_id: existingTable.event_id,
          id: { not: existingTable.id },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "A table with this slug already exists for this event" },
          { status: 400 }
        );
      }
    }

    // Update the table
    const updatedTable = await prisma.table.update({
      where: { id: existingTable.id },
      data: {
        name: name.trim(),
        slug: newSlug?.trim() || slug,
        type: type === "PREPAID" ? "PREPAID" : "CAPTAIN_PAYG",
        status: ["ACTIVE", "CLOSED", "ARCHIVED"].includes(status) ? status : existingTable.status,
        capacity: typeof capacity === "number" && capacity > 0 ? capacity : existingTable.capacity,
        table_number: tableNumber || null,
        internal_name: internalName || null,
        welcome_message: welcomeMessage || null,
      },
      include: {
        event: {
          select: {
            name: true,
          },
        },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingTable.event.organization_id,
        event_id: existingTable.event_id,
        actor_id: user.id,
        action: "TABLE_UPDATED",
        entity_type: "TABLE",
        entity_id: updatedTable.id,
        metadata: {
          tableName: updatedTable.name,
          changes: {
            name: name !== existingTable.name ? { from: existingTable.name, to: name } : undefined,
            slug: newSlug !== slug ? { from: slug, to: newSlug } : undefined,
            type: type !== existingTable.type ? { from: existingTable.type, to: type } : undefined,
            status: status !== existingTable.status ? { from: existingTable.status, to: status } : undefined,
          },
        },
      },
    });

    return NextResponse.json({
      table: {
        id: updatedTable.id,
        name: updatedTable.name,
        slug: updatedTable.slug,
        type: updatedTable.type,
        status: updatedTable.status,
        capacity: updatedTable.capacity,
        eventName: updatedTable.event.name,
      },
    });
  } catch (error) {
    console.error("Failed to update table:", error);
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tables/[slug] - Delete a table
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;

    // Find the existing table
    const existingTable = await prisma.table.findFirst({
      where: { slug },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
          },
        },
        _count: {
          select: {
            guest_assignments: true,
            orders: true,
          },
        },
      },
    });

    if (!existingTable) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check if table has guests or orders
    if (existingTable._count.guest_assignments > 0) {
      return NextResponse.json(
        { error: "Cannot delete table with assigned guests. Please remove all guests first." },
        { status: 400 }
      );
    }

    if (existingTable._count.orders > 0) {
      return NextResponse.json(
        { error: "Cannot delete table with associated orders." },
        { status: 400 }
      );
    }

    // Delete the table
    await prisma.table.delete({
      where: { id: existingTable.id },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingTable.event.organization_id,
        event_id: existingTable.event_id,
        actor_id: user.id,
        action: "TABLE_DELETED",
        entity_type: "TABLE",
        entity_id: existingTable.id,
        metadata: {
          tableName: existingTable.name,
          tableSlug: existingTable.slug,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete table:", error);
    return NextResponse.json(
      { error: "Failed to delete table" },
      { status: 500 }
    );
  }
}
