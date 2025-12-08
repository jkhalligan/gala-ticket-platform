import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
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

    // Find the waitlist entry
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id },
      include: {
        event: true,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    if (entry.status !== "WAITING") {
      return NextResponse.json(
        { error: "Only waiting entries can be cancelled" },
        { status: 400 }
      );
    }

    // Update the waitlist entry status
    await prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: entry.event.organization_id,
        event_id: entry.event_id,
        actor_id: user.id,
        action: "ADMIN_OVERRIDE",
        entity_type: "WAITLIST_ENTRY",
        entity_id: entry.id,
        metadata: {
          action: "cancelled",
          email: entry.email,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel waitlist entry:", error);
    return NextResponse.json(
      { error: "Failed to cancel waitlist entry" },
      { status: 500 }
    );
  }
}
