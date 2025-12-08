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

    const guestAssignments = await prisma.guestAssignment.findMany({
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
            name: true,
            slug: true,
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

    const formattedGuests = guestAssignments.map((assignment) => {
      // Use display_name if available, otherwise combine user first/last name
      const name =
        assignment.display_name ||
        [assignment.user.first_name, assignment.user.last_name]
          .filter(Boolean)
          .join(" ") ||
        assignment.user.email;

      return {
        id: assignment.id,
        name,
        email: assignment.user.email,
        tier: assignment.tier,
        tableName: assignment.table?.name || null,
        tableSlug: assignment.table?.slug || null,
        checkedIn: assignment.checked_in_at !== null,
        checkedInAt: assignment.checked_in_at?.toISOString() || null,
        eventName: assignment.event.name,
        auctionRegistered: assignment.auction_registered,
        bidderNumber: assignment.bidder_number,
        dietaryRestrictions: assignment.dietary_restrictions,
      };
    });

    return NextResponse.json({ guests: formattedGuests });
  } catch (error) {
    console.error("Failed to fetch guests:", error);
    return NextResponse.json(
      { error: "Failed to fetch guests" },
      { status: 500 }
    );
  }
}
