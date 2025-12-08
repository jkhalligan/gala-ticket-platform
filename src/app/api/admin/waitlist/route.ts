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

    const waitlistEntries = await prisma.waitlistEntry.findMany({
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
        event: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const formattedEntries = waitlistEntries.map((entry) => ({
      id: entry.id,
      email: entry.email || entry.user?.email || "Unknown",
      quantity: entry.quantity,
      status: entry.status,
      notes: entry.notes,
      tableName: entry.table?.name || null,
      eventName: entry.event.name,
      createdAt: entry.created_at.toISOString(),
    }));

    return NextResponse.json({ entries: formattedEntries });
  } catch (error) {
    console.error("Failed to fetch waitlist entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist entries" },
      { status: 500 }
    );
  }
}
