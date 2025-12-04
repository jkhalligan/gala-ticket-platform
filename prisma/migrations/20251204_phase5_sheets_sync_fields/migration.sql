-- Phase 5: Sheets Sync Schema Migration
-- =============================================================================
-- Migration: phase5_sheets_sync_fields
-- Description: Adds fields required for Google Sheets sync functionality
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add reference_code to Table
-- -----------------------------------------------------------------------------
-- Format: "YY-TNNN" where YY is 2-digit year, NNN is sequential number
-- Example: "25-T001", "25-T002"

ALTER TABLE "Table" ADD COLUMN "reference_code" TEXT;

-- Create unique index (per event)
CREATE UNIQUE INDEX "Table_event_id_reference_code_key" ON "Table"("event_id", "reference_code");

-- -----------------------------------------------------------------------------
-- 2. Add tier to GuestAssignment
-- -----------------------------------------------------------------------------
-- Snapshot of ticket tier at purchase time (STANDARD, VIP, VVIP)
-- Immutable - avoids join to Order → Product for exports/reporting

ALTER TABLE "GuestAssignment" ADD COLUMN "tier" "ProductTier" NOT NULL DEFAULT 'STANDARD';

-- -----------------------------------------------------------------------------
-- 3. Add organization_id to GuestAssignment (denormalized)
-- -----------------------------------------------------------------------------
-- Denormalized from Event for reference_code scoping
-- Simplifies unique constraint and avoids joins for code generation

ALTER TABLE "GuestAssignment" ADD COLUMN "organization_id" TEXT;

-- Populate organization_id from existing events
UPDATE "GuestAssignment" ga
SET "organization_id" = e."organization_id"
FROM "Event" e
WHERE ga."event_id" = e."id";

-- Make it NOT NULL after population
ALTER TABLE "GuestAssignment" ALTER COLUMN "organization_id" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "GuestAssignment" 
ADD CONSTRAINT "GuestAssignment_organization_id_fkey" 
FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index for organization_id
CREATE INDEX "GuestAssignment_organization_id_idx" ON "GuestAssignment"("organization_id");

-- -----------------------------------------------------------------------------
-- 4. Add reference_code to GuestAssignment
-- -----------------------------------------------------------------------------
-- Format: "GNNNN" where NNNN is 4-digit sequential number per organization
-- Example: "G0001", "G0002"

ALTER TABLE "GuestAssignment" ADD COLUMN "reference_code" TEXT;

-- Create unique index (per organization)
CREATE UNIQUE INDEX "GuestAssignment_organization_id_reference_code_key" 
ON "GuestAssignment"("organization_id", "reference_code");