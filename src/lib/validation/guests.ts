// src/lib/validation/guests.ts
// Zod schemas for guest assignment API validation

import { z } from 'zod';

// =============================================================================
// DIETARY RESTRICTIONS
// =============================================================================

export const DietaryRestrictionsSchema = z.object({
  restrictions: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
}).nullable();

// =============================================================================
// CREATE GUEST ASSIGNMENT
// =============================================================================

export const CreateGuestSchema = z.object({
  event_id: z.string().cuid(),
  table_id: z.string().cuid().optional(), // Optional: unassigned guests have no table
  order_id: z.string().cuid(),
  
  // Either provide user_id for existing user, or email to create/find user
  user_id: z.string().cuid().optional(),
  email: z.string().email().optional(),
  
  // Guest details
  display_name: z.string().max(100).optional(),
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
  
  dietary_restrictions: DietaryRestrictionsSchema.optional(),
}).refine(
  (data) => data.user_id || data.email,
  { message: 'Either user_id or email must be provided' }
);

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;

// =============================================================================
// UPDATE GUEST ASSIGNMENT
// =============================================================================

export const UpdateGuestSchema = z.object({
  table_id: z.string().cuid().nullable().optional(),
  display_name: z.string().max(100).nullable().optional(),
  dietary_restrictions: DietaryRestrictionsSchema.optional(),
  bidder_number: z.string().max(20).nullable().optional(),
  auction_registered: z.boolean().optional(),
});

export type UpdateGuestInput = z.infer<typeof UpdateGuestSchema>;

// =============================================================================
// GUEST FILTERS
// =============================================================================

export const GuestFiltersSchema = z.object({
  event_id: z.string().cuid().optional(),
  table_id: z.string().cuid().optional(),
  user_id: z.string().cuid().optional(),
  order_id: z.string().cuid().optional(),
  
  // Filter by check-in status
  checked_in: z.coerce.boolean().optional(),
  
  // Search by name or email
  search: z.string().max(100).optional(),
  
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GuestFilters = z.infer<typeof GuestFiltersSchema>;

// =============================================================================
// REASSIGN GUEST
// =============================================================================

export const ReassignGuestSchema = z.object({
  guest_assignment_id: z.string().cuid(),
  new_table_id: z.string().cuid(),
});

export type ReassignGuestInput = z.infer<typeof ReassignGuestSchema>;

// =============================================================================
// CHECK-IN
// =============================================================================

export const CheckInGuestSchema = z.object({
  qr_code_token: z.string().optional(),
  guest_assignment_id: z.string().cuid().optional(),
}).refine(
  (data) => data.qr_code_token || data.guest_assignment_id,
  { message: 'Either qr_code_token or guest_assignment_id must be provided' }
);

export type CheckInGuestInput = z.infer<typeof CheckInGuestSchema>;

// =============================================================================
// BULK OPERATIONS
// =============================================================================

export const BulkUpdateGuestsSchema = z.object({
  guest_ids: z.array(z.string().cuid()).min(1).max(100),
  updates: z.object({
    table_id: z.string().cuid().nullable().optional(),
    auction_registered: z.boolean().optional(),
  }),
});

export type BulkUpdateGuestsInput = z.infer<typeof BulkUpdateGuestsSchema>;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export const GuestResponseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  table_id: z.string().nullable(),
  user_id: z.string(),
  order_id: z.string(),
  display_name: z.string().nullable(),
  dietary_restrictions: DietaryRestrictionsSchema,
  bidder_number: z.string().nullable(),
  checked_in_at: z.date().nullable(),
  qr_code_token: z.string().nullable(),
  auction_registered: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
  
  // Joined data
  user: z.object({
    id: z.string(),
    email: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    phone: z.string().nullable(),
  }).optional(),
  
  table: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }).nullable().optional(),
});

export type GuestResponse = z.infer<typeof GuestResponseSchema>;
