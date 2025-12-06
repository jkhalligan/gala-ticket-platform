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

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const eventId = searchParams.get("eventId");

    if (!slug) {
      return NextResponse.json(
        { error: "Slug parameter is required" },
        { status: 400 }
      );
    }

    // Build the where clause - check within event scope if eventId provided
    const whereClause: { slug: string; event_id?: string } = { slug };
    if (eventId) {
      whereClause.event_id = eventId;
    }

    // Fast count check for slug uniqueness
    const count = await prisma.table.count({
      where: whereClause,
    });

    return NextResponse.json({ isUnique: count === 0 });
  } catch (error) {
    console.error("Failed to validate slug:", error);
    return NextResponse.json(
      { error: "Failed to validate slug" },
      { status: 500 }
    );
  }
}
