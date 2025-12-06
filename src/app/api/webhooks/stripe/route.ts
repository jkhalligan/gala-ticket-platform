// src/app/api/webhooks/stripe/route.ts
// =============================================================================
// Stripe Webhook Handler
// =============================================================================
// POST /api/webhooks/stripe
// Handles payment_intent.succeeded to complete orders and create guest assignments
// Phase 5 Update: Added reference_code, organization_id, and tier fields
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent } from "@/lib/stripe";
import { randomBytes } from "crypto";
import { 
  generateTableReferenceCode, 
  generateGuestReferenceCode,
  getOrganizationIdFromEvent,
  getProductTier,
} from "@/lib/reference-codes";

// =============================================================================
// Webhook Configuration
// =============================================================================

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

if (!WEBHOOK_SECRET) {
  console.error("⚠️ STRIPE_WEBHOOK_SECRET is not set");
}

// =============================================================================
// POST /api/webhooks/stripe
// =============================================================================

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text(); // Raw body required for signature verification

  if (!signature) {
    console.error("❌ Missing Stripe signature");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  // 1. Verify webhook signature
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.log(`✅ Stripe Event Received: ${event.type} [${event.id}]`);

  // 2. Check idempotency - have we already processed this event?
  const existingLog = await prisma.stripeEventLog.findUnique({
    where: { stripe_event_id: event.id },
  });

  if (existingLog?.processed) {
    console.log(`⏭️ Event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, skipped: true });
  }

  // 3. Log the event (before processing)
  const eventLog = await prisma.stripeEventLog.upsert({
    where: { stripe_event_id: event.id },
    create: {
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as any,
      processed: false,
    },
    update: {
      payload: event as any,
    },
  });

  // 4. Route to appropriate handler
  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      // Add more event types as needed
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    // 5. Mark event as processed
    await prisma.stripeEventLog.update({
      where: { id: eventLog.id },
      data: {
        processed: true,
        processed_at: new Date(),
      },
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error(`❌ Error processing ${event.type}:`, error);

    // Log the error but don't fail the webhook (Stripe will retry)
    await prisma.stripeEventLog.update({
      where: { id: eventLog.id },
      data: {
        error_message: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Return 200 to prevent Stripe retries for business logic errors
    // Return 500 only for transient errors that should be retried
    return NextResponse.json({ received: true, error: true });
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle successful payment - complete order and create guest assignments
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`💰 Processing payment_intent.succeeded: ${paymentIntent.id}`);

  const metadata = paymentIntent.metadata;

  // Validate required metadata
  if (!metadata.event_id || !metadata.user_id || !metadata.product_id) {
    console.error("❌ Missing required metadata in PaymentIntent");
    throw new Error("Missing required metadata");
  }

  const eventId = metadata.event_id;
  const userId = metadata.user_id;
  const productId = metadata.product_id;
  const quantity = parseInt(metadata.quantity || "1", 10);
  const tableId = metadata.table_id || null;
  const promoCodeId = metadata.promo_code_id || null;
  const orderFlow = metadata.order_flow || "individual";

  // 1. Find the pending order by payment intent ID
  let order = await prisma.order.findUnique({
    where: { stripe_payment_intent_id: paymentIntent.id },
  });

  if (order?.status === "COMPLETED") {
    console.log(`⏭️ Order ${order.id} already completed, skipping`);
    return;
  }

  // 2. Get event for activity logging and organization_id
  const eventRecord = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organization_id: true },
  });

  if (!eventRecord) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const organizationId = eventRecord.organization_id;

  // 3. Handle different order flows
  let finalTableId = tableId;

  if (orderFlow === "full_table") {
    // Create new PREPAID table for full table purchases
    finalTableId = await createPrepaidTable({
      eventId,
      userId,
      organizationId,
      paymentIntent,
    });
  }

  // 4. Create or update order
  if (order) {
    // Update existing pending order
    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        table_id: finalTableId,
        stripe_charge_id: paymentIntent.latest_charge as string || null,
      },
    });
  } else {
    // Create new order (shouldn't happen normally, but handle edge case)
    order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
        product_id: productId,
        table_id: finalTableId,
        promo_code_id: promoCodeId,
        quantity,
        amount_cents: paymentIntent.amount,
        discount_cents: 0,
        status: "COMPLETED",
        stripe_payment_intent_id: paymentIntent.id,
        stripe_charge_id: paymentIntent.latest_charge as string || null,
      },
    });
  }

  // 5. Get product tier for guest assignment (Phase 5)
  const tier = await getProductTier(productId);

  // 6. Generate guest reference code (Phase 5)
  const guestReferenceCode = await generateGuestReferenceCode(organizationId);

  // 7. Create guest assignment for the buyer (first seat)
  await prisma.guestAssignment.create({
    data: {
      event_id: eventId,
      organization_id: organizationId,  // Phase 5
      table_id: finalTableId,
      user_id: userId,
      order_id: order.id,
      tier: tier as any,  // Phase 5: snapshot from product
      reference_code: guestReferenceCode,  // Phase 5
    },
  });

  // 8. Create placeholder logic note:
  // Remaining seats (quantity - 1) are "placeholder" seats
  // They exist as (order.quantity - guestAssignments.count) 
  // No explicit records needed - calculated dynamically

  // 9. Increment promo code usage
  if (promoCodeId) {
    await prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { current_uses: { increment: 1 } },
    });
  }

  // 10. Log activity
  await prisma.activityLog.create({
    data: {
      organization_id: organizationId,
      event_id: eventId,
      actor_id: userId,
      action: "ORDER_COMPLETED",
      entity_type: "ORDER",
      entity_id: order.id,
      metadata: {
        amount_cents: paymentIntent.amount,
        quantity,
        order_flow: orderFlow,
        stripe_payment_intent_id: paymentIntent.id,
      },
    },
  });

  console.log(`✅ Order ${order.id} completed with ${quantity} seat(s)`);
}

/**
 * Handle failed payment - update order status
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`❌ Processing payment_intent.payment_failed: ${paymentIntent.id}`);

  const order = await prisma.order.findUnique({
    where: { stripe_payment_intent_id: paymentIntent.id },
  });

  if (!order) {
    console.log("ℹ️ No order found for failed payment intent");
    return;
  }

  // Update order to reflect failure (keep as PENDING for retry)
  await prisma.order.update({
    where: { id: order.id },
    data: {
      notes: `Payment failed: ${paymentIntent.last_payment_error?.message || "Unknown error"}`,
    },
  });

  console.log(`📝 Order ${order.id} marked with payment failure`);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a PREPAID table for full table purchases
 * Phase 5 Update: Added reference_code generation
 */
async function createPrepaidTable({
  eventId,
  userId,
  organizationId,
  paymentIntent,
}: {
  eventId: string;
  userId: string;
  organizationId: string;
  paymentIntent: Stripe.PaymentIntent;
}): Promise<string> {
  const tableName = paymentIntent.metadata.table_name || "My Table";
  const capacity = parseInt(paymentIntent.metadata.table_capacity || "10", 10);

  // Generate slug and reference code (Phase 5)
  const slug = generateTableSlug(tableName);
  const referenceCode = await generateTableReferenceCode(eventId);

  const table = await prisma.table.create({
    data: {
      event_id: eventId,
      primary_owner_id: userId,
      name: tableName,
      slug,
      type: "PREPAID",
      status: "ACTIVE",
      capacity,
      custom_total_price_cents: paymentIntent.amount,
      reference_code: referenceCode,  // Phase 5
    },
  });

  // Add owner role
  await prisma.tableUserRole.create({
    data: {
      table_id: table.id,
      user_id: userId,
      role: "OWNER",
    },
  });

  // Log table creation
  await prisma.activityLog.create({
    data: {
      organization_id: organizationId,
      event_id: eventId,
      actor_id: userId,
      action: "TABLE_CREATED",
      entity_type: "TABLE",
      entity_id: table.id,
      metadata: {
        table_name: tableName,
        type: "PREPAID",
        capacity,
        reference_code: referenceCode,
        stripe_payment_intent_id: paymentIntent.id,
      },
    },
  });

  console.log(`🪑 Created PREPAID table: ${table.name} (${table.id}) [${referenceCode}]`);

  return table.id;
}

/**
 * Generate a URL-safe slug from a table name
 */
function generateTableSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30); // Limit base length

  const suffix = randomBytes(4).toString("hex");
  return `${base}-${suffix}`;
}