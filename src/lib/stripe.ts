// =============================================================================
// Stripe Client Utility
// =============================================================================
// Shared Stripe instance for the Pink Gala Platform
// Uses Stripe SDK v20.x
// =============================================================================

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Stripe SDK v20 uses the latest API version by default
  // Explicitly set for stability
  apiVersion: "2025-11-17.clover",
  typescript: true,
});

// =============================================================================
// Helper Types
// =============================================================================

export interface CreatePaymentIntentParams {
  amount_cents: number;
  currency?: string;
  metadata: {
    event_id: string;
    user_id: string;
    product_id: string;
    quantity: number;
    table_id?: string;
    promo_code_id?: string;
    order_flow: "individual" | "individual_at_table" | "full_table" | "captain_commitment";
    // For full_table purchases - passed to webhook for table creation
    table_name?: string;
    table_internal_name?: string;
  };
  receipt_email?: string;
  description?: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
}

// =============================================================================
// Payment Intent Creation
// =============================================================================

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const { amount_cents, currency = "usd", metadata, receipt_email, description } = params;

  // Stripe requires amount in smallest currency unit (cents for USD)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency,
    metadata: {
      ...metadata,
      // Convert non-string values for Stripe metadata (must be strings)
      quantity: String(metadata.quantity),
    },
    receipt_email,
    description,
    // Automatic payment methods allows Stripe to show best options
    automatic_payment_methods: {
      enabled: true,
    },
  });

  if (!paymentIntent.client_secret) {
    throw new Error("PaymentIntent created without client_secret");
  }

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
  };
}

// =============================================================================
// Webhook Signature Verification
// =============================================================================

export function constructWebhookEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}

// =============================================================================
// Price Formatting
// =============================================================================

export function formatCentsToDisplay(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
