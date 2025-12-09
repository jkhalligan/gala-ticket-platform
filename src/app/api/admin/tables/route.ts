import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeCapacity = searchParams.get('include_capacity') === 'true';

    const tables = await prisma.table.findMany({
      include: {
        event: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            guest_assignments: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const formattedTables = tables.map((table) => {
      const filledSeats = table._count.guest_assignments;
      const percentageFilled = table.capacity > 0 ? (filledSeats / table.capacity) * 100 : 0;

      let availability: "available" | "almost_full" | "at_capacity" = "available";
      if (percentageFilled >= 100) {
        availability = "at_capacity";
      } else if (percentageFilled >= 70) {
        availability = "almost_full";
      }

      const baseData = {
        id: table.id,
        name: table.name,
        slug: table.slug,
        type: table.type,
        capacity: table.capacity,
        filledSeats,
        status: table.status,
        eventId: table.event.id,
        eventName: table.event.name,
      };

      if (includeCapacity) {
        return {
          ...baseData,
          filled_seats: filledSeats,
          availability,
          percentage_filled: Math.round(percentageFilled),
        };
      }

      return baseData;
    });

    return NextResponse.json({ tables: formattedTables });
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, eventId, capacity, type, welcomeMessage, internalName, tableNumber } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    // Verify the event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Generate a unique slug from the name
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for existing slugs and append a number if necessary
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.table.findFirst({ where: { slug, event_id: eventId } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create the table
    const table = await prisma.table.create({
      data: {
        name: name.trim(),
        slug,
        event_id: eventId,
        primary_owner_id: user.id,
        capacity: capacity && typeof capacity === "number" ? capacity : 10,
        type: type === "PREPAID" ? "PREPAID" : "CAPTAIN_PAYG",
        welcome_message: welcomeMessage || null,
        internal_name: internalName || null,
        table_number: tableNumber || null,
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
        organization_id: event.organization_id,
        event_id: eventId,
        actor_id: user.id,
        action: "TABLE_CREATED",
        entity_type: "TABLE",
        entity_id: table.id,
        metadata: {
          tableName: table.name,
          tableType: table.type,
          capacity: table.capacity,
        },
      },
    });

    return NextResponse.json({
      table: {
        id: table.id,
        name: table.name,
        slug: table.slug,
        type: table.type,
        capacity: table.capacity,
        status: table.status,
        eventName: table.event.name,
      },
    });
  } catch (error) {
    console.error("Failed to create table:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
