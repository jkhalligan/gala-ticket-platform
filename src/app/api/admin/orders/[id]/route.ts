import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/admin/orders/[id] - Fetch a single order with deep details
export async function GET(
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

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            kind: true,
            tier: true,
            price_cents: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            event_date: true,
            organization_id: true,
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        promo_code: {
          select: {
            id: true,
            code: true,
            discount_type: true,
            discount_value: true,
          },
        },
        guest_assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const formattedOrder = {
      id: order.id,
      status: order.status,
      amountCents: order.amount_cents,
      discountCents: order.discount_cents,
      quantity: order.quantity,
      notes: order.notes,
      isAdminCreated: order.is_admin_created,
      invitedEmail: order.invited_email,
      customPriceCents: order.custom_price_cents,
      paymentLinkToken: order.payment_link_token,
      paymentLinkExpires: order.payment_link_expires?.toISOString() || null,
      stripePaymentIntentId: order.stripe_payment_intent_id,
      stripeChargeId: order.stripe_charge_id,
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString(),
      user: {
        id: order.user.id,
        email: order.user.email,
        firstName: order.user.first_name,
        lastName: order.user.last_name,
        phone: order.user.phone,
      },
      product: {
        id: order.product.id,
        name: order.product.name,
        kind: order.product.kind,
        tier: order.product.tier,
        priceCents: order.product.price_cents,
      },
      event: {
        id: order.event.id,
        name: order.event.name,
        eventDate: order.event.event_date.toISOString(),
      },
      table: order.table
        ? {
            id: order.table.id,
            name: order.table.name,
            slug: order.table.slug,
          }
        : null,
      promoCode: order.promo_code
        ? {
            id: order.promo_code.id,
            code: order.promo_code.code,
            discountType: order.promo_code.discount_type,
            discountValue: order.promo_code.discount_value,
          }
        : null,
      guestAssignments: order.guest_assignments.map((ga) => ({
        id: ga.id,
        displayName: ga.display_name,
        userId: ga.user_id,
        userEmail: ga.user.email,
        userFirstName: ga.user.first_name,
        userLastName: ga.user.last_name,
        tier: ga.tier,
        checkedInAt: ga.checked_in_at?.toISOString() || null,
      })),
    };

    return NextResponse.json({ order: formattedOrder });
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/orders/[id] - Update an order
export async function PUT(
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

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            organization_id: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, notes, tableId } = body;

    // Validate status if provided
    const validStatuses = ["PENDING", "AWAITING_PAYMENT", "COMPLETED", "REFUNDED", "CANCELLED", "EXPIRED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: status || existingOrder.status,
        notes: notes !== undefined ? notes : existingOrder.notes,
        table_id: tableId !== undefined ? tableId : existingOrder.table_id,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingOrder.event.organization_id,
        event_id: existingOrder.event_id,
        actor_id: user.id,
        action: status === "REFUNDED" ? "ORDER_REFUNDED" : status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_COMPLETED",
        entity_type: "ORDER",
        entity_id: id,
        metadata: {
          previousStatus: existingOrder.status,
          newStatus: status,
        },
      },
    });

    return NextResponse.json({
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/orders/[id] - Cancel/delete an order
export async function DELETE(
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

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            organization_id: true,
          },
        },
        _count: {
          select: {
            guest_assignments: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Cannot delete completed orders with guest assignments
    if (existingOrder.status === "COMPLETED" && existingOrder._count.guest_assignments > 0) {
      return NextResponse.json(
        { error: "Cannot delete completed order with guest assignments. Process a refund instead." },
        { status: 400 }
      );
    }

    // For safety, mark as cancelled rather than hard delete
    const cancelledOrder = await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingOrder.event.organization_id,
        event_id: existingOrder.event_id,
        actor_id: user.id,
        action: "ORDER_CANCELLED",
        entity_type: "ORDER",
        entity_id: id,
        metadata: {
          previousStatus: existingOrder.status,
          amountCents: existingOrder.amount_cents,
        },
      },
    });

    return NextResponse.json({ success: true, order: { id: cancelledOrder.id, status: cancelledOrder.status } });
  } catch (error) {
    console.error("Failed to cancel order:", error);
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
