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

    // Fetch activity logs with actor and event info
    const activityLogs = await prisma.activityLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
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
      take: 500, // Limit to last 500 logs for performance
    });

    // Fetch entity labels for common entity types
    const entityLabels = new Map<string, string>();

    // Collect entity IDs by type
    const userIds = new Set<string>();
    const tableIds = new Set<string>();
    const orderIds = new Set<string>();
    const guestIds = new Set<string>();

    for (const log of activityLogs) {
      switch (log.entity_type) {
        case "USER":
          userIds.add(log.entity_id);
          break;
        case "TABLE":
          tableIds.add(log.entity_id);
          break;
        case "ORDER":
          orderIds.add(log.entity_id);
          break;
        case "GUEST_ASSIGNMENT":
          guestIds.add(log.entity_id);
          break;
      }
    }

    // Batch fetch entity labels
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, email: true, first_name: true, last_name: true },
      });
      for (const u of users) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
        entityLabels.set(`USER:${u.id}`, name);
      }
    }

    if (tableIds.size > 0) {
      const tables = await prisma.table.findMany({
        where: { id: { in: Array.from(tableIds) } },
        select: { id: true, name: true },
      });
      for (const t of tables) {
        entityLabels.set(`TABLE:${t.id}`, t.name);
      }
    }

    if (orderIds.size > 0) {
      const orders = await prisma.order.findMany({
        where: { id: { in: Array.from(orderIds) } },
        select: { id: true, user: { select: { email: true } } },
      });
      for (const o of orders) {
        entityLabels.set(`ORDER:${o.id}`, `Order by ${o.user.email}`);
      }
    }

    if (guestIds.size > 0) {
      const guests = await prisma.guestAssignment.findMany({
        where: { id: { in: Array.from(guestIds) } },
        select: { id: true, display_name: true, user: { select: { email: true, first_name: true, last_name: true } } },
      });
      for (const g of guests) {
        const name = g.display_name ||
          [g.user.first_name, g.user.last_name].filter(Boolean).join(" ") ||
          g.user.email;
        entityLabels.set(`GUEST_ASSIGNMENT:${g.id}`, name);
      }
    }

    // Format the logs
    const formattedLogs = activityLogs.map((log) => {
      const actorName = log.actor
        ? [log.actor.first_name, log.actor.last_name].filter(Boolean).join(" ") || null
        : null;

      const entityLabel = entityLabels.get(`${log.entity_type}:${log.entity_id}`) || null;

      return {
        id: log.id,
        actorName,
        actorEmail: log.actor?.email || null,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        entityLabel,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.created_at.toISOString(),
        eventName: log.event?.name || null,
      };
    });

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}
