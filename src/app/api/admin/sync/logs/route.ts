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
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 }
      );
    }

    // Fetch sync-related activity logs for this event
    const logs = await prisma.activityLog.findMany({
      where: {
        event_id: eventId,
        action: "SHEETS_SYNC",
      },
      select: {
        id: true,
        action: true,
        created_at: true,
        metadata: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 20, // Limit to last 20 sync logs
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.created_at.toISOString(),
      metadata: log.metadata as Record<string, unknown> || {},
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.error("Failed to fetch sync logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}
