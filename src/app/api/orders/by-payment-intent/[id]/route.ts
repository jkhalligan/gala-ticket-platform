// =============================================================================
// Order by Payment Intent ID API Route
// =============================================================================
// GET /api/orders/by-payment-intent/[id] - Get order by Stripe payment intent ID
// Used after payment to get table slug for redirect
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// =============================================================================
// GET /api/orders/by-payment-intent/[id]
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paymentIntentId } = await params;

    // Fetch order by payment intent ID
    const order = await prisma.order.findUnique({
      where: { stripe_payment_intent_id: paymentIntentId },
      include: {
        product: {
          select: { kind: true, tier: true },
        },
        table: {
          select: { id: true, slug: true, name: true },
        },
        guest_assignments: {
          select: { id: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        status: order.status,
        product_kind: order.product.kind,
        product_tier: order.product.tier,
        table_id: order.table?.id || null,
        table_slug: order.table?.slug || null,
        table_name: order.table?.name || null,
        quantity: order.quantity,
        amount_cents: order.amount_cents,
        guest_count: order.guest_assignments.length,
      },
    });

  } catch (error) {
    console.error("Error fetching order by payment intent:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
