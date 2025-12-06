import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tables = await prisma.table.findMany({
      include: {
        event: {
          select: {
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

    const formattedTables = tables.map((table) => ({
      id: table.id,
      name: table.name,
      slug: table.slug,
      type: table.type,
      capacity: table.capacity,
      filledSeats: table._count.guest_assignments,
      status: table.status,
      eventName: table.event.name,
    }));

    return NextResponse.json({ tables: formattedTables });
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}
