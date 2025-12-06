// src/lib/reference-codes.ts
// Reference code generators for Sheets sync (Phase 5)
// 
// Table codes: "25-T001" (year prefix + sequential)
// Guest codes: "G0001" (sequential per organization)

import { prisma } from './prisma';

/**
 * Generate a reference code for a new Table
 * Format: "YY-TNNN" (e.g., "25-T001", "25-T002")
 * 
 * @param eventId - The event this table belongs to
 * @returns Reference code string
 */
export async function generateTableReferenceCode(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { event_date: true },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const year = event.event_date.getFullYear().toString().slice(-2); // "25"

  // Find max existing code for this event
  // Order by reference_code descending to get the highest number
  const lastTable = await prisma.table.findFirst({
    where: {
      event_id: eventId,
      reference_code: { not: null },
    },
    orderBy: { reference_code: 'desc' },
    select: { reference_code: true },
  });

  let nextNum = 1;
  if (lastTable?.reference_code) {
    // Extract number from format "25-T001"
    const match = lastTable.reference_code.match(/T(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `${year}-T${nextNum.toString().padStart(3, '0')}`; // "25-T001"
}

/**
 * Generate a reference code for a new GuestAssignment
 * Format: "GNNNN" (e.g., "G0001", "G0002")
 * Scoped per organization for uniqueness
 * 
 * @param organizationId - The organization this guest belongs to
 * @returns Reference code string
 */
export async function generateGuestReferenceCode(organizationId: string): Promise<string> {
  // Find max existing code for this organization
  const lastGuest = await prisma.guestAssignment.findFirst({
    where: {
      organization_id: organizationId,
      reference_code: { not: null },
    },
    orderBy: { reference_code: 'desc' },
    select: { reference_code: true },
  });

  let nextNum = 1;
  if (lastGuest?.reference_code) {
    // Extract number from format "G0001"
    const match = lastGuest.reference_code.match(/G(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `G${nextNum.toString().padStart(4, '0')}`; // "G0001"
}

/**
 * Get organization ID from event ID
 * Helper for guest assignment creation where we only have event_id
 * 
 * @param eventId - The event ID
 * @returns Organization ID
 */
export async function getOrganizationIdFromEvent(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organization_id: true },
  });

  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  return event.organization_id;
}

/**
 * Generate both organization_id and reference_code for a new GuestAssignment
 * Convenience function that combines the lookups
 * 
 * @param eventId - The event ID
 * @returns Object with organization_id and reference_code
 */
export async function generateGuestAssignmentCodes(eventId: string): Promise<{
  organization_id: string;
  reference_code: string;
}> {
  const organizationId = await getOrganizationIdFromEvent(eventId);
  const referenceCode = await generateGuestReferenceCode(organizationId);

  return {
    organization_id: organizationId,
    reference_code: referenceCode,
  };
}

/**
 * Get the tier from a product
 * Helper for guest assignment creation to snapshot tier
 * 
 * @param productId - The product ID
 * @returns ProductTier enum value
 */
export async function getProductTier(productId: string): Promise<string> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { tier: true },
  });

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  return product.tier;
}