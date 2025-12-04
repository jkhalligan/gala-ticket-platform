// =============================================================================
// Checkout API Route
// =============================================================================
// POST /api/checkout
// Creates PaymentIntent for paid orders or directly creates Order for $0 flows
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createPaymentIntent, formatCentsToDisplay } from "@/lib/stripe";
import {
  CheckoutRequestSchema,
  CheckoutResponse,
  CheckoutRequest,
  PriceCalculation,
  PromoCodeResult,
} from "@/lib/validation/checkout";
import { randomBytes } from "crypto";

// =============================================================================
// POST /api/checkout
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<CheckoutResponse>> {
  try {
    // 1. Parse and validate request body
    const body = await req.json();
    const parseResult = CheckoutRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const data: CheckoutRequest = parseResult.data;

    // 2. Get or create user
    const user = await getOrCreateUser(data.buyer_info);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Failed to identify user", code: "USER_ERROR" },
        { status: 400 }
      );
    }

    // 3. Validate product
    const product = await prisma.product.findUnique({
      where: { id: data.product_id },
      include: { event: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found", code: "PRODUCT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!product.is_active) {
      return NextResponse.json(
        { success: false, error: "Product is not available", code: "PRODUCT_INACTIVE" },
        { status: 400 }
      );
    }

    if (product.event_id !== data.event_id) {
      return NextResponse.json(
        { success: false, error: "Product does not belong to this event", code: "EVENT_MISMATCH" },
        { status: 400 }
      );
    }

    // 4. Validate table for individual_at_table flow
    let targetTable: { id: string; capacity: number; name: string } | null = null;
    if (data.order_flow === "individual_at_table") {
      targetTable = await validateJoinTable(data.table_id!, data.event_id, data.quantity);
      if (!targetTable) {
        return NextResponse.json(
          { success: false, error: "Table not found or has no available seats", code: "TABLE_ERROR" },
          { status: 400 }
        );
      }
    }

    // 5. Calculate price
    const priceCalc = await calculatePrice({
      product,
      quantity: data.quantity,
      promo_code: data.promo_code,
      event_id: data.event_id,
      table_id: data.table_id,
    });

    if ("error" in priceCalc) {
      return NextResponse.json(
        { success: false, error: priceCalc.error, code: "PRICE_ERROR" },
        { status: 400 }
      );
    }

    // 6. Handle $0 orders (captain_commitment) directly
    if (priceCalc.total_cents === 0) {
      const result = await createZeroDollarOrder({
        user_id: user.id,
        event_id: data.event_id,
        product_id: data.product_id,
        quantity: data.quantity,
        order_flow: data.order_flow,
        table_id: targetTable?.id,
        table_info: data.table_info,
        promo_code_id: priceCalc.promo_code_id,
        discount_cents: priceCalc.discount_cents,
      });

      return NextResponse.json({
        success: true,
        order_id: result.order_id,
        amount_cents: 0,
        original_amount_cents: priceCalc.subtotal_cents,
        discount_cents: priceCalc.discount_cents,
        promo_code_applied: data.promo_code,
      });
    }

    // 7. Create PaymentIntent for paid orders
    const paymentResult = await createPaymentIntent({
      amount_cents: priceCalc.total_cents,
      metadata: {
        event_id: data.event_id,
        user_id: user.id,
        product_id: data.product_id,
        quantity: data.quantity,
        table_id: targetTable?.id,
        promo_code_id: priceCalc.promo_code_id,
        order_flow: data.order_flow,
        // Include table info for full_table purchases (used by webhook to create table)
        table_name: data.table_info?.name,
        table_internal_name: data.table_info?.internal_name,
      },
      receipt_email: data.buyer_info.email,
      description: `Pink Gala: ${product.name} x${data.quantity}`,
    });

    // 8. Create pending order record
    await prisma.order.create({
      data: {
        event_id: data.event_id,
        user_id: user.id,
        product_id: data.product_id,
        table_id: targetTable?.id,
        promo_code_id: priceCalc.promo_code_id,
        quantity: data.quantity,
        amount_cents: priceCalc.total_cents,
        discount_cents: priceCalc.discount_cents,
        status: "PENDING",
        stripe_payment_intent_id: paymentResult.paymentIntentId,
      },
    });

    return NextResponse.json({
      success: true,
      payment_intent_id: paymentResult.paymentIntentId,
      client_secret: paymentResult.clientSecret,
      amount_cents: priceCalc.total_cents,
      original_amount_cents: priceCalc.subtotal_cents,
      discount_cents: priceCalc.discount_cents,
      promo_code_applied: data.promo_code,
    });

  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get existing user or create a new one from buyer info
 */
async function getOrCreateUser(buyerInfo: CheckoutRequest["buyer_info"]) {
  // First try to get authenticated user
  const currentUser = await getCurrentUser();
  if (currentUser) {
    return currentUser;
  }

  // Look for existing user by email
  let user = await prisma.user.findUnique({
    where: { email: buyerInfo.email.toLowerCase() },
  });

  if (!user) {
    // Create new user
    user = await prisma.user.create({
      data: {
        email: buyerInfo.email.toLowerCase(),
        first_name: buyerInfo.first_name,
        last_name: buyerInfo.last_name,
        phone: buyerInfo.phone,
      },
    });
  }

  return user;
}

/**
 * Validate that a table exists and has capacity for the requested seats
 */
async function validateJoinTable(
  tableId: string,
  eventId: string,
  requestedSeats: number
): Promise<{ id: string; capacity: number; name: string } | null> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      orders: {
        where: { status: "COMPLETED" },
        select: { quantity: true },
      },
    },
  });

  if (!table || table.event_id !== eventId || table.status !== "ACTIVE") {
    return null;
  }

  // Calculate available seats
  const purchasedSeats = table.orders.reduce((sum, o) => sum + o.quantity, 0);
  const availableSeats = table.capacity - purchasedSeats;

  if (availableSeats < requestedSeats) {
    return null;
  }

  return { id: table.id, capacity: table.capacity, name: table.name };
}

/**
 * Calculate total price including promo code discount
 */
async function calculatePrice(params: {
  product: { price_cents: number; kind: string };
  quantity: number;
  promo_code?: string;
  event_id: string;
  table_id?: string;
}): Promise<PriceCalculation | { error: string }> {
  const { product, quantity, promo_code, event_id, table_id } = params;

  // Get base price (might be overridden for tables with custom pricing)
  let unitPrice = product.price_cents;

  // If joining a table, check for custom seat pricing
  if (table_id) {
    const table = await prisma.table.findUnique({
      where: { id: table_id },
      select: { seat_price_cents: true, custom_total_price_cents: true, capacity: true },
    });

    if (table?.seat_price_cents !== null && table?.seat_price_cents !== undefined) {
      unitPrice = table.seat_price_cents;
    } else if (table?.custom_total_price_cents !== null && table?.custom_total_price_cents !== undefined && table.capacity > 0) {
      unitPrice = Math.round(table.custom_total_price_cents / table.capacity);
    }
  }

  const subtotal = unitPrice * quantity;
  let discountCents = 0;
  let promoCodeId: string | undefined;

  // Validate and apply promo code
  if (promo_code) {
    const promoResult = await validatePromoCode(event_id, promo_code, subtotal);
    if (!promoResult.valid) {
      return { error: promoResult.error || "Invalid promo code" };
    }
    discountCents = promoResult.discount_cents || 0;
    promoCodeId = promoResult.promo_code_id;
  }

  const total = Math.max(0, subtotal - discountCents);

  return {
    product_price_cents: unitPrice,
    quantity,
    subtotal_cents: subtotal,
    discount_cents: discountCents,
    total_cents: total,
    promo_code_id: promoCodeId,
  };
}

/**
 * Validate promo code and calculate discount
 */
async function validatePromoCode(
  eventId: string,
  code: string,
  subtotalCents: number
): Promise<PromoCodeResult> {
  const promoCode = await prisma.promoCode.findUnique({
    where: {
      event_id_code: {
        event_id: eventId,
        code: code.toUpperCase(),
      },
    },
  });

  if (!promoCode) {
    return { valid: false, error: "Promo code not found" };
  }

  if (!promoCode.is_active) {
    return { valid: false, error: "Promo code is no longer active" };
  }

  const now = new Date();
  if (promoCode.valid_from > now) {
    return { valid: false, error: "Promo code is not yet valid" };
  }

  if (promoCode.valid_until && promoCode.valid_until < now) {
    return { valid: false, error: "Promo code has expired" };
  }

  if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
    return { valid: false, error: "Promo code has reached its usage limit" };
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
 */
async function createZeroDollarOrder(params: {
  user_id: string;
  event_id: string;
  product_id: string;
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
    product_id,
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

  // Create guest assignment for the captain/buyer
  await prisma.guestAssignment.create({
    data: {
      event_id,
      table_id: finalTableId,
      user_id,
      order_id: order.id,
    },
  });

  // Increment promo code usage if applicable
  if (promo_code_id) {
    await prisma.promoCode.update({
      where: { id: promo_code_id },
      data: { current_uses: { increment: 1 } },
    });
  }

  // Log activity
  const event = await prisma.event.findUnique({
    where: { id: event_id },
    select: { organization_id: true },
  });

  if (event) {
    await prisma.activityLog.create({
      data: {
        organization_id: event.organization_id,
        event_id,
        actor_id: user_id,
        action: "ORDER_COMPLETED",
        entity_type: "ORDER",
        entity_id: order.id,
        metadata: {
          order_flow,
          amount_cents: 0,
          quantity,
        },
      },
    });
  }

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
