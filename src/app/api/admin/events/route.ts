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

    const events = await prisma.event.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        event_date: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        event_date: "desc",
      },
    });

    const formattedEvents = events.map((event) => ({
      id: event.id,
      name: event.name,
      slug: event.slug,
      eventDate: event.event_date.toISOString(),
      organizationName: event.organization.name,
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    console.error("Failed to fetch events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
