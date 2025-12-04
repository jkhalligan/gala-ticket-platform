// =============================================================================
// Order by ID API Route
// =============================================================================
// GET   /api/orders/[id]  - Get order details
// PATCH /api/orders/[id]  - Update order (admin only)
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { OrderUpdateSchema } from "@/lib/validation/orders";

// =============================================================================
// GET /api/orders/[id]
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch order with relations
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, last_name: true, phone: true },
        },
        product: {
          select: { id: true, name: true, kind: true, tier: true, price_cents: true },
        },
        table: {
          select: { id: true, name: true, slug: true, type: true },
        },
        promo_code: {
          select: { id: true, code: true, discount_type: true, discount_value: true },
        },
        event: {
          select: { id: true, name: true, organization_id: true },
        },
        guest_assignments: {
          include: {
            user: {
              select: { id: true, email: true, first_name: true, last_name: true },
            },
            tags: {
              include: { tag: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 3. Check permissions - user must own order or be admin
    if (order.user_id !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Format response
    return NextResponse.json({
      order: {
        id: order.id,
        event_id: order.event_id,
        user_id: order.user_id,
        product_id: order.product_id,
        table_id: order.table_id,
        promo_code_id: order.promo_code_id,
        quantity: order.quantity,
        amount_cents: order.amount_cents,
        discount_cents: order.discount_cents,
        status: order.status,
        stripe_payment_intent_id: order.stripe_payment_intent_id,
        stripe_charge_id: order.stripe_charge_id,
        is_admin_created: order.is_admin_created,
        invited_email: order.invited_email,
        custom_price_cents: order.custom_price_cents,
        payment_link_token: user.isAdmin ? order.payment_link_token : null, // Only show to admins
        payment_link_expires: order.payment_link_expires?.toISOString() || null,
        notes: order.notes,
        created_at: order.created_at.toISOString(),
        updated_at: order.updated_at.toISOString(),
        // Relations
        buyer: {
          id: order.user.id,
          email: order.user.email,
          first_name: order.user.first_name,
          last_name: order.user.last_name,
          phone: order.user.phone,
        },
        product: order.product,
        table: order.table,
        event: order.event,
        promo_code: order.promo_code,
        guest_assignments: order.guest_assignments.map((g) => ({
          id: g.id,
          user_id: g.user_id,
          display_name: g.display_name,
          dietary_restrictions: g.dietary_restrictions,
          checked_in_at: g.checked_in_at?.toISOString() || null,
          user: {
            email: g.user.email,
            first_name: g.user.first_name,
            last_name: g.user.last_name,
          },
          tags: g.tags.map((t) => ({
            id: t.tag.id,
            name: t.tag.name,
            color: t.tag.color,
          })),
        })),
        // Computed values
        seats_assigned: order.guest_assignments.length,
        seats_remaining: order.quantity - order.guest_assignments.length,
      },
    });

  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/orders/[id]
// =============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Require admin authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 2. Fetch existing order
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 3. Parse and validate update data
    const body = await req.json();
    const data = OrderUpdateSchema.parse(body);

    // 4. Build update object
    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    if (data.table_id !== undefined) {
      // Validate table exists if not null
      if (data.table_id !== null) {
        const table = await prisma.table.findUnique({
          where: { id: data.table_id },
        });
        if (!table || table.event_id !== existingOrder.event_id) {
          return NextResponse.json({ error: "Table not found" }, { status: 404 });
        }
      }
      updateData.table_id = data.table_id;
    }

    // 5. Update order
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    // 6. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: existingOrder.event.organization_id,
        event_id: existingOrder.event_id,
        actor_id: user.id,
        action: data.status === "CANCELLED" ? "ORDER_CANCELLED" : 
               data.status === "REFUNDED" ? "ORDER_REFUNDED" : "ORDER_COMPLETED",
        entity_type: "ORDER",
        entity_id: id,
        metadata: {
          changes: data,
          previous_status: existingOrder.status,
        },
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        table_id: updatedOrder.table_id,
        notes: updatedOrder.notes,
        updated_at: updatedOrder.updated_at.toISOString(),
      },
    });

  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update order" },
      { status: 500 }
    );
  }
}
