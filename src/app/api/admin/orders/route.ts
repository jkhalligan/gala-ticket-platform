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

    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        product: {
          select: {
            name: true,
            kind: true,
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

    const formattedOrders = orders.map((order) => {
      // Combine user first/last name or use email
      const buyerName =
        [order.user.first_name, order.user.last_name]
          .filter(Boolean)
          .join(" ") || order.user.email;

      return {
        id: order.id,
        buyerName,
        buyerEmail: order.user.email,
        productName: order.product.name,
        productKind: order.product.kind,
        amountCents: order.amount_cents,
        status: order.status,
        createdAt: order.created_at.toISOString(),
        eventName: order.event.name,
      };
    });

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
