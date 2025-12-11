// src/app/api/checkout/route.ts
// =============================================================================
// Checkout API - Create PaymentIntent or Complete $0 Orders
// =============================================================================
// Phase 5 Update: Added reference_code, organization_id, tier on table/guest creation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createPaymentIntent } from "@/lib/stripe";
import { CheckoutRequestSchema } from "@/lib/validation/checkout";
import { randomBytes } from "crypto";
import {
  generateTableReferenceCode,
  generateGuestReferenceCode,
  getProductTier,
} from "@/lib/reference-codes";

// =============================================================================
// HELPER: Calculate Subtotal
// =============================================================================

/**
 * Calculate subtotal based on product kind
 * - FULL_TABLE: price_cents is the total (don't multiply)
 * - INDIVIDUAL_TICKET: price_cents is per-seat (multiply by quantity)
 * - CAPTAIN_COMMITMENT: Usually $0, but handle like individual tickets
 */
function calculateSubtotal(product: { kind: string; price_cents: number }, quantity: number): number {
  if (product.kind === 'FULL_TABLE') {
    return product.price_cents;
  } else {
    return product.price_cents * quantity;
  }
}

// =============================================================================
// POST /api/checkout
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Get current user (optional for guest checkout)
    const currentUser = await getCurrentUser();

    // 2. Parse and validate request
    const body = await request.json();
    const data = CheckoutRequestSchema.parse(body);

    // 3. Verify product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: data.product_id },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
            tickets_on_sale: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.is_active) {
      return NextResponse.json({ error: "Product is not available" }, { status: 400 });
    }

    if (product.event_id !== data.event_id) {
      return NextResponse.json(
        { error: "Product does not belong to this event" },
        { status: 400 }
      );
    }

    // 3a. Validate quantity based on product kind
    if (product.kind === 'FULL_TABLE' && data.quantity !== 1) {
      return NextResponse.json(
        { error: "Can only purchase 1 table at a time" },
        { status: 400 }
      );
    }

    if (product.kind === 'INDIVIDUAL_TICKET' && (data.quantity < 1 || data.quantity > 10)) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 10 for individual tickets" },
        { status: 400 }
      );
    }

    // 4. Find or create buyer user
    let buyerUserId: string;
    let buyerEmail: string;
    if (currentUser) {
      buyerUserId = currentUser.id;
      buyerEmail = currentUser.email;
    } else {
      let buyer = await prisma.user.findUnique({
        where: { email: data.buyer_info.email.toLowerCase() },
      });

      if (!buyer) {
        buyer = await prisma.user.create({
          data: {
            email: data.buyer_info.email.toLowerCase(),
            first_name: data.buyer_info.first_name,
            last_name: data.buyer_info.last_name,
            phone: data.buyer_info.phone,
          },
        });
      }
      buyerUserId = buyer.id;
      buyerEmail = buyer.email;
    }

    // 5. Validate table if joining existing
    let tableId = data.table_id;
    if (data.order_flow === "individual_at_table" && tableId) {
      const table = await prisma.table.findUnique({
        where: { id: tableId },
      });

      if (!table || table.event_id !== data.event_id) {
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
      }

      // Check if table has capacity
      const [completedOrders, assignedGuests] = await Promise.all([
        prisma.order.aggregate({
          where: { table_id: tableId, status: "COMPLETED" },
          _sum: { quantity: true },
        }),
        prisma.guestAssignment.count({
          where: { table_id: tableId },
        }),
      ]);

      const totalPurchased = completedOrders._sum.quantity || 0;
      if (totalPurchased >= table.capacity) {
        return NextResponse.json({ error: "Table is full" }, { status: 400 });
      }
    }

    // 6. Calculate subtotal (used for promo validation AND final amount)
    const subtotalCents = calculateSubtotal(product, data.quantity);

    console.log(`💰 Subtotal calculation:`, {
      product_kind: product.kind,
      price_cents: product.price_cents,
      quantity: data.quantity,
      subtotal_cents: subtotalCents,
      display: `$${(subtotalCents / 100).toFixed(2)}`,
    });

    // 7. Validate promo code if provided
    let promoValidation: {
      valid: boolean;
      error?: string;
      promo_code_id?: string;
      discount_cents: number;
      discount_type?: string;
      discount_value?: number;
    } = { valid: true, promo_code_id: undefined, discount_cents: 0 };

    if (data.promo_code) {
      promoValidation = await validatePromoCode(
        data.promo_code,
        data.event_id,
        subtotalCents  // ✅ Using pre-calculated subtotal (no double-multiplication bug)
      );

      if (!promoValidation.valid) {
        return NextResponse.json({ error: promoValidation.error }, { status: 400 });
      }
    }

    // 8. Calculate final amount
    const discountCents = promoValidation.discount_cents;
    const totalCents = Math.max(0, subtotalCents - discountCents);

    console.log(`💳 Final amount:`, {
      subtotal: subtotalCents,
      discount: discountCents,
      total: totalCents,
      display: `$${(totalCents / 100).toFixed(2)}`,
    });

    // 9. Handle $0 orders (captain commitment or fully discounted)
    if (totalCents === 0) {
      const result = await createZeroDollarOrder({
        user_id: buyerUserId,
        event_id: data.event_id,
        organization_id: product.event.organization_id,
        product_id: data.product_id,
        product_tier: product.tier,
        quantity: data.quantity,
        order_flow: data.order_flow,
        table_id: tableId,
        table_info: data.table_info,
        promo_code_id: promoValidation.promo_code_id,
        discount_cents: discountCents,
      });

      // Get table slug if a table was created
      let tableSlug: string | undefined;
      if (result.table_id) {
        const table = await prisma.table.findUnique({
          where: { id: result.table_id },
          select: { slug: true },
        });
        tableSlug = table?.slug;
      }

      return NextResponse.json({
        success: true,
        requires_payment: false,
        order_id: result.order_id,
        table_id: result.table_id,
        table_slug: tableSlug,
        product_kind: product.kind,
      });
    }

    // 10. Create pending order
    const order = await prisma.order.create({
      data: {
        event_id: data.event_id,
        user_id: buyerUserId,
        product_id: data.product_id,
        table_id: tableId,
        promo_code_id: promoValidation.promo_code_id,
        quantity: data.quantity,
        amount_cents: totalCents,
        discount_cents: discountCents,
        status: "PENDING",
      },
    });

    // 11. Create PaymentIntent with metadata for webhook
    const paymentIntent = await createPaymentIntent({
      amount_cents: totalCents,
      currency: "usd",
      metadata: {
        event_id: data.event_id,
        user_id: buyerUserId,
        product_id: data.product_id,
        quantity: data.quantity,
        order_flow: data.order_flow,
        table_id: tableId,
        promo_code_id: promoValidation.promo_code_id,
        table_name: data.table_info?.name,
      },
      receipt_email: buyerEmail,
    });

    // 12. Update order with PaymentIntent ID
    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripe_payment_intent_id: paymentIntent.paymentIntentId,
      },
    });

    return NextResponse.json({
      success: true,
      requires_payment: true,
      order_id: order.id,
      client_secret: paymentIntent.clientSecret,
      amount_cents: totalCents,
      discount_cents: discountCents,
      product_kind: product.kind,
    });

  } catch (error) {
    console.error("Checkout error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate a promo code
 */
async function validatePromoCode(
  code: string,
  eventId: string,
  subtotalCents: number
): Promise<{
  valid: boolean;
  error?: string;
  promo_code_id?: string;
  discount_cents: number;
  discount_type?: string;
  discount_value?: number;
}> {
  const promoCode = await prisma.promoCode.findUnique({
    where: {
      event_id_code: {
        event_id: eventId,
        code: code.toUpperCase(),
      },
    },
  });

  if (!promoCode) {
    return { valid: false, error: "Invalid promo code", discount_cents: 0 };
  }

  if (!promoCode.is_active) {
    return { valid: false, error: "Promo code is no longer active", discount_cents: 0 };
  }

  const now = new Date();

  if (promoCode.valid_from > now) {
    return { valid: false, error: "Promo code is not yet valid", discount_cents: 0 };
  }

  if (promoCode.valid_until && promoCode.valid_until < now) {
    return { valid: false, error: "Promo code has expired", discount_cents: 0 };
  }

  if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
    return { valid: false, error: "Promo code has reached its usage limit", discount_cents: 0 };
  }

  // Calculate discount
  let discountCents: number;
  if (promoCode.discount_type === "PERCENTAGE") {
    discountCents = Math.round((subtotalCents * promoCode.discount_value) / 100);
  } else {
    // FIXED_AMOUNT
    discountCents = Math.min(promoCode.discount_value, subtotalCents);
  }

  return {
    valid: true,
    promo_code_id: promoCode.id,
    discount_cents: discountCents,
    discount_type: promoCode.discount_type,
    discount_value: promoCode.discount_value,
  };
}

/**
 * Create a $0 order (captain commitment or fully discounted)
 * Phase 5 Update: Added reference codes and tier
 */
async function createZeroDollarOrder(params: {
  user_id: string;
  event_id: string;
  organization_id: string;
  product_id: string;
  product_tier: string;
  quantity: number;
  order_flow: string;
  table_id?: string;
  table_info?: { name: string; internal_name?: string };
  promo_code_id?: string;
  discount_cents: number;
}): Promise<{ order_id: string; table_id?: string }> {
  const {
    user_id,
    event_id,
    organization_id,
    product_id,
    product_tier,
    quantity,
    order_flow,
    table_id,
    table_info,
    promo_code_id,
    discount_cents,
  } = params;

  let finalTableId = table_id;

  // For captain_commitment, create a new CAPTAIN_PAYG table
  if (order_flow === "captain_commitment" && table_info) {
    const slug = generateTableSlug(table_info.name);
    
    // Phase 5: Generate reference code for table
    const tableReferenceCode = await generateTableReferenceCode(event_id);

    const newTable = await prisma.table.create({
      data: {
        event_id,
        primary_owner_id: user_id,
        name: table_info.name,
        internal_name: table_info.internal_name,
        slug,
        type: "CAPTAIN_PAYG",
        capacity: 10, // Default capacity
        status: "ACTIVE",
        reference_code: tableReferenceCode,  // Phase 5
      },
    });

    // Add captain role
    await prisma.tableUserRole.create({
      data: {
        table_id: newTable.id,
        user_id: user_id,
        role: "CAPTAIN",
      },
    });

    // Log table creation
    await prisma.activityLog.create({
      data: {
        organization_id,
        event_id,
        actor_id: user_id,
        action: "TABLE_CREATED",
        entity_type: "TABLE",
        entity_id: newTable.id,
        metadata: {
          table_name: table_info.name,
          type: "CAPTAIN_PAYG",
          reference_code: tableReferenceCode,
        },
      },
    });

    finalTableId = newTable.id;
  }

  // Create the order
  const order = await prisma.order.create({
    data: {
      event_id,
      user_id,
      product_id,
      table_id: finalTableId,
      promo_code_id,
      quantity,
      amount_cents: 0,
      discount_cents,
      status: "COMPLETED",
    },
  });

  // Phase 5: Generate reference code for guest assignment
  const guestReferenceCode = await generateGuestReferenceCode(organization_id);

  // Create guest assignment for the captain/buyer
  // Defensive check to prevent duplicate assignments
  const existingAssignment = await prisma.guestAssignment.findFirst({
    where: {
      event_id,
      table_id: finalTableId,
      user_id,
    },
  });

  if (!existingAssignment) {
    await prisma.guestAssignment.create({
      data: {
        event_id,
        organization_id,  // Phase 5
        table_id: finalTableId,
        user_id,
        order_id: order.id,
        tier: product_tier as any,  // Phase 5
        reference_code: guestReferenceCode,  // Phase 5
      },
    });
  }

  // Increment promo code usage if applicable
  if (promo_code_id) {
    await prisma.promoCode.update({
      where: { id: promo_code_id },
      data: { current_uses: { increment: 1 } },
    });
  }

  // Log order completion
  await prisma.activityLog.create({
    data: {
      organization_id,
      event_id,
      actor_id: user_id,
      action: "ORDER_COMPLETED",
      entity_type: "ORDER",
      entity_id: order.id,
      metadata: {
        order_flow,
        amount_cents: 0,
        quantity,
        guest_reference_code: guestReferenceCode,
      },
    },
  });

  return { order_id: order.id, table_id: finalTableId };
}

/**
 * Generate a URL-safe slug from a table name
 */
function generateTableSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const suffix = randomBytes(4).toString("hex");
  return `${base}-${suffix}`;
}