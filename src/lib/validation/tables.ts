// src/lib/validation/tables.ts
// Zod schemas for table API validation

import { z } from 'zod';

// =============================================================================
// ENUMS (matching Prisma)
// =============================================================================

export const TableTypeSchema = z.enum(['PREPAID', 'CAPTAIN_PAYG']);
export const TableStatusSchema = z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']);
export const TablePaymentStatusSchema = z.enum(['NOT_APPLICABLE', 'UNPAID', 'PAID_OFFLINE', 'COMPED']);
export const TableRoleSchema = z.enum(['OWNER', 'CO_OWNER', 'CAPTAIN', 'MANAGER', 'STAFF']);

// =============================================================================
// CREATE TABLE
// =============================================================================

export const CreateTableSchema = z.object({
  event_id: z.string().cuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  welcome_message: z.string().max(500).optional(),
  internal_name: z.string().max(100).optional(),
  
  type: TableTypeSchema,
  capacity: z.number().int().min(1).max(20).default(10),
  
  // Pricing (optional, for admin-created tables)
  custom_total_price_cents: z.number().int().min(0).optional(),
  seat_price_cents: z.number().int().min(0).optional(),
  payment_status: TablePaymentStatusSchema.optional(),
  payment_notes: z.string().max(500).optional(),
});

export type CreateTableInput = z.infer<typeof CreateTableSchema>;

// =============================================================================
// UPDATE TABLE
// =============================================================================

export const UpdateTableSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  welcome_message: z.string().max(500).nullable().optional(),
  internal_name: z.string().max(100).nullable().optional(),
  table_number: z.string().max(20).nullable().optional(),
  
  status: TableStatusSchema.optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  
  custom_total_price_cents: z.number().int().min(0).nullable().optional(),
  seat_price_cents: z.number().int().min(0).nullable().optional(),
  payment_status: TablePaymentStatusSchema.optional(),
  payment_notes: z.string().max(500).nullable().optional(),
});

export type UpdateTableInput = z.infer<typeof UpdateTableSchema>;

// =============================================================================
// TABLE FILTERS
// =============================================================================

export const TableFiltersSchema = z.object({
  event_id: z.string().cuid().optional(),
  status: TableStatusSchema.optional(),
  type: TableTypeSchema.optional(),
  primary_owner_id: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TableFilters = z.infer<typeof TableFiltersSchema>;

// =============================================================================
// TABLE ROLE MANAGEMENT
// =============================================================================

export const AddTableRoleSchema = z.object({
  table_id: z.string().cuid(),
  user_id: z.string().cuid(),
  role: TableRoleSchema,
});

export type AddTableRoleInput = z.infer<typeof AddTableRoleSchema>;

export const RemoveTableRoleSchema = z.object({
  table_id: z.string().cuid(),
  user_id: z.string().cuid(),
  role: TableRoleSchema,
});

export type RemoveTableRoleInput = z.infer<typeof RemoveTableRoleSchema>;

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export const TableResponseSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  primary_owner_id: z.string(),
  name: z.string(),
  slug: z.string(),
  welcome_message: z.string().nullable(),
  internal_name: z.string().nullable(),
  table_number: z.string().nullable(),
  type: TableTypeSchema,
  status: TableStatusSchema,
  capacity: z.number(),
  custom_total_price_cents: z.number().nullable(),
  seat_price_cents: z.number().nullable(),
  payment_status: TablePaymentStatusSchema,
  payment_notes: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type TableResponse = z.infer<typeof TableResponseSchema>;
