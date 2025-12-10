// =============================================================================
// Stripe Client Utility
// =============================================================================
// Shared Stripe instance for the Pink Gala Platform
// Uses Stripe SDK v20.x
// =============================================================================

import Stripe from "stripe";
import { loadStripe, type Stripe as StripeClient } from "@stripe/stripe-js";

// =============================================================================
// Client-side Stripe (for React components)
// =============================================================================

let stripePromise: Promise<StripeClient | null> | null = null;

/**
 * Get Stripe.js instance for client-side use
 * Singleton pattern - only loads once
 */
export function getStripePromise(): Promise<StripeClient | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(publishableKey);
  }

  return stripePromise;
}

// =============================================================================
// Server-side Stripe
// =============================================================================

// Server-side Stripe client - only initialized on the server
// Using a lazy initialization pattern to avoid client-side errors
let _stripe: Stripe | null = null;

function getServerStripe(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("Server Stripe client cannot be used on the client side");
  }

  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    });
  }

  return _stripe;
}

// Export getter for server-side usage
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getServerStripe()[prop as keyof Stripe];
  },
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
