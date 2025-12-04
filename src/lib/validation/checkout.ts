// =============================================================================
// Checkout Validation Schemas
// =============================================================================
// Zod 4.x validation for checkout API
// Supports all order flows: individual, individual_at_table, full_table, captain_commitment
// =============================================================================

import { z } from "zod";

// =============================================================================
// Order Flow Type
// =============================================================================

export const OrderFlowSchema = z.enum([
  "individual",           // Individual ticket, no table selected
  "individual_at_table",  // Individual ticket joining existing table
  "full_table",           // Full table purchase (PREPAID)
  "captain_commitment",   // $0 captain commitment (CAPTAIN_PAYG)
]);

export type OrderFlow = z.infer<typeof OrderFlowSchema>;

// =============================================================================
// Checkout Request Schema
// =============================================================================

export const CheckoutRequestSchema = z.object({
  // Required fields
  event_id: z.string().min(1, "Event ID is required"),
  product_id: z.string().min(1, "Product ID is required"),
  
  // Order flow determines what type of purchase this is
  order_flow: OrderFlowSchema,
  
  // Quantity (default 1 for individual tickets)
  quantity: z.number().int().min(1).max(20).default(1),
  
  // Optional: Table to join (required for individual_at_table)
  table_id: z.string().optional(),
  
  // Optional: Promo code
  promo_code: z.string().optional(),
  
  // Guest info for the purchaser (first seat assignment)
  buyer_info: z.object({
    email: z.string().email("Invalid email address"),
    first_name: z.string().min(1, "First name is required").optional(),
    last_name: z.string().min(1, "Last name is required").optional(),
    phone: z.string().optional(),
  }),
  
  // For full table purchases: table details
  table_info: z.object({
    name: z.string().min(1, "Table name is required"),
    internal_name: z.string().optional(),
  }).optional(),
  
}).refine(
  (data) => {
    // individual_at_table requires table_id
    if (data.order_flow === "individual_at_table" && !data.table_id) {
      return false;
    }
    return true;
  },
  {
    message: "table_id is required when joining an existing table",
    path: ["table_id"],
  }
).refine(
  (data) => {
    // full_table requires table_info
    if (data.order_flow === "full_table" && !data.table_info) {
      return false;
    }
    return true;
  },
  {
    message: "table_info is required for full table purchases",
    path: ["table_info"],
  }
);

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

// =============================================================================
// Checkout Response Types
// =============================================================================

export interface CheckoutSuccessResponse {
  success: true;
  // For paid orders
  payment_intent_id?: string;
  client_secret?: string;
  // For $0 orders (captain commitment, comp)
  order_id?: string;
  // Always included
  amount_cents: number;
  original_amount_cents: number;
  discount_cents: number;
  promo_code_applied?: string;
}

export interface CheckoutErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type CheckoutResponse = CheckoutSuccessResponse | CheckoutErrorResponse;

// =============================================================================
// Promo Code Validation
// =============================================================================

export const PromoCodeValidationSchema = z.object({
  event_id: z.string().min(1),
  code: z.string().min(1),
  amount_cents: z.number().int().min(0),
});

export type PromoCodeValidation = z.infer<typeof PromoCodeValidationSchema>;

export interface PromoCodeResult {
  valid: boolean;
  promo_code_id?: string;
  discount_cents?: number;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value?: number;
  error?: string;
}

// =============================================================================
// Price Calculation Types
// =============================================================================

export interface PriceCalculation {
  product_price_cents: number;
  quantity: number;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code_id?: string;
}
