// =============================================================================
// Order Validation Schemas
// =============================================================================
// Zod 4.x validation for order-related operations
// =============================================================================

import { z } from "zod";

// =============================================================================
// Order Status Enum
// =============================================================================

export const OrderStatusSchema = z.enum([
  "PENDING",
  "AWAITING_PAYMENT",
  "COMPLETED",
  "REFUNDED",
  "CANCELLED",
  "EXPIRED",
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// =============================================================================
// Order Query Schema (for GET /api/orders)
// =============================================================================

export const OrderQuerySchema = z.object({
  event_id: z.string().optional(),
  user_id: z.string().optional(),
  table_id: z.string().optional(),
  status: OrderStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrderQuery = z.infer<typeof OrderQuerySchema>;

// =============================================================================
// Admin Order Creation Schema (for ticket invitations)
// =============================================================================

export const AdminCreateOrderSchema = z.object({
  event_id: z.string().min(1, "Event ID is required"),
  product_id: z.string().min(1, "Product ID is required"),
  
  // Recipient info
  invited_email: z.string().email("Valid email required"),
  
  // Optional: assign to specific table
  table_id: z.string().optional(),
  
  // Optional: custom price override (null = use product price)
  custom_price_cents: z.number().int().min(0).optional(),
  
  // Optional: quantity
  quantity: z.number().int().min(1).max(20).default(1),
  
  // Optional: admin notes
  notes: z.string().optional(),
  
  // Payment link expiration (default 7 days)
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

export type AdminCreateOrder = z.infer<typeof AdminCreateOrderSchema>;

// =============================================================================
// Order Update Schema
// =============================================================================

export const OrderUpdateSchema = z.object({
  status: OrderStatusSchema.optional(),
  notes: z.string().optional(),
  table_id: z.string().nullable().optional(),
});

export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;

// =============================================================================
// Payment Link Schema (for /pay/[token] page)
// =============================================================================

export const PaymentLinkTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type PaymentLinkToken = z.infer<typeof PaymentLinkTokenSchema>;

// =============================================================================
// Order Response Types
// =============================================================================

export interface OrderSummary {
  id: string;
  event_id: string;
  user_id: string;
  product_id: string;
  table_id: string | null;
  quantity: number;
  amount_cents: number;
  discount_cents: number;
  status: OrderStatus;
  created_at: string;
  // Computed
  product_name?: string;
  buyer_email?: string;
  buyer_name?: string;
  table_name?: string;
}

export interface OrderDetail extends OrderSummary {
  promo_code_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  is_admin_created: boolean;
  invited_email: string | null;
  custom_price_cents: number | null;
  payment_link_token: string | null;
  payment_link_expires: string | null;
  notes: string | null;
  updated_at: string;
  // Relations
  guest_assignments: Array<{
    id: string;
    user_id: string;
    display_name: string | null;
    user_email?: string;
    user_name?: string;
  }>;
}

// =============================================================================
// Comp Ticket Schema (for creating free tickets)
// =============================================================================

export const CompTicketSchema = z.object({
  event_id: z.string().min(1, "Event ID is required"),
  product_id: z.string().min(1, "Product ID is required"),
  
  // Recipient info
  email: z.string().email("Valid email required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  
  // Optional: assign to specific table
  table_id: z.string().optional(),
  
  // Optional: quantity
  quantity: z.number().int().min(1).max(20).default(1),
  
  // Optional: admin notes
  notes: z.string().optional(),
});

export type CompTicket = z.infer<typeof CompTicketSchema>;
