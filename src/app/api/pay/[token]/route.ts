// =============================================================================
// Payment Link API Route
// =============================================================================
// GET  /api/pay/[token]  - Get order details by payment link token
// POST /api/pay/[token]  - Create PaymentIntent for the order
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent, formatCentsToDisplay } from "@/lib/stripe";

// =============================================================================
// GET /api/pay/[token]
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Find order by payment link token
    const order = await prisma.order.findUnique({
      where: { payment_link_token: token },
      include: {
        product: {
          select: { id: true, name: true, kind: true, tier: true, price_cents: true },
        },
        event: {
          select: { id: true, name: true, event_date: true, organization_id: true },
        },
        table: {
          select: { id: true, name: true, slug: true },
        },
        user: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Payment link not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Check if link has expired
    if (order.payment_link_expires && order.payment_link_expires < new Date()) {
      // Mark order as expired if not already
      if (order.status === "AWAITING_PAYMENT") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "EXPIRED" },
        });
      }

      return NextResponse.json(
        { error: "Payment link has expired", code: "EXPIRED" },
        { status: 410 }
      );
    }

    // 3. Check order status
    if (order.status === "COMPLETED") {
      return NextResponse.json(
        { error: "This order has already been paid", code: "ALREADY_PAID" },
        { status: 400 }
      );
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This order has been cancelled", code: "CANCELLED" },
        { status: 400 }
      );
    }

    if (order.status === "EXPIRED") {
      return NextResponse.json(
        { error: "This payment link has expired", code: "EXPIRED" },
        { status: 410 }
      );
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return NextResponse.json(
        { error: "This order is not available for payment", code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // 4. Return order details for payment page
    return NextResponse.json({
      order: {
        id: order.id,
        quantity: order.quantity,
        amount_cents: order.amount_cents,
        amount_display: formatCentsToDisplay(order.amount_cents),
        status: order.status,
        expires_at: order.payment_link_expires?.toISOString() || null,
        product: {
          name: order.product.name,
          kind: order.product.kind,
          tier: order.product.tier,
        },
        event: {
          name: order.event.name,
          date: order.event.event_date?.toISOString() || null,
        },
        table: order.table ? {
          name: order.table.name,
        } : null,
        recipient: {
          email: order.invited_email || order.user.email,
          name: [order.user.first_name, order.user.last_name].filter(Boolean).join(" ") || null,
        },
      },
    });

  } catch (error) {
    console.error("Error fetching payment link:", error);
    return NextResponse.json(
      { error: "Failed to load payment details" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/pay/[token]
// =============================================================================
// Creates a PaymentIntent for the order
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Find order by payment link token
    const order = await prisma.order.findUnique({
      where: { payment_link_token: token },
      include: {
        product: true,
        event: true,
        user: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Payment link not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Validate order is still payable
    if (order.payment_link_expires && order.payment_link_expires < new Date()) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Payment link has expired", code: "EXPIRED" },
        { status: 410 }
      );
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return NextResponse.json(
        { error: "This order is not available for payment", code: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    // 3. Check if PaymentIntent already exists
    if (order.stripe_payment_intent_id) {
      // Return existing PaymentIntent client secret
      const stripe = (await import("@/lib/stripe")).stripe;
      const existingIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      
      if (existingIntent.status === "requires_payment_method" || 
          existingIntent.status === "requires_confirmation" ||
          existingIntent.status === "requires_action") {
        return NextResponse.json({
          success: true,
          payment_intent_id: existingIntent.id,
          client_secret: existingIntent.client_secret,
          amount_cents: order.amount_cents,
        });
      }
    }

    // 4. Create new PaymentIntent
    const paymentResult = await createPaymentIntent({
      amount_cents: order.amount_cents,
      metadata: {
        event_id: order.event_id,
        user_id: order.user_id,
        product_id: order.product_id,
        quantity: order.quantity,
        table_id: order.table_id || undefined,
        order_flow: "individual", // Admin invitations are treated as individual tickets
      },
      receipt_email: order.invited_email || order.user.email,
      description: `Pink Gala: ${order.product.name} x${order.quantity} (Invitation)`,
    });

    // 5. Update order with PaymentIntent ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripe_payment_intent_id: paymentResult.paymentIntentId,
        status: "PENDING", // Move from AWAITING_PAYMENT to PENDING
      },
    });

    return NextResponse.json({
      success: true,
      payment_intent_id: paymentResult.paymentIntentId,
      client_secret: paymentResult.clientSecret,
      amount_cents: order.amount_cents,
    });

  } catch (error) {
    console.error("Error creating payment for invitation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment" },
      { status: 500 }
    );
  }
}
