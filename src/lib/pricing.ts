// =============================================================================
// Pricing Utility Functions
// =============================================================================
// Shared pricing logic for frontend and backend to ensure consistency
// =============================================================================

/**
 * Calculate order subtotal based on product kind
 * - FULL_TABLE: price is the total (don't multiply by quantity)
 * - INDIVIDUAL_TICKET: price is per-seat (multiply by quantity)
 * - CAPTAIN_COMMITMENT: usually $0, treat like individual tickets
 *
 * This ensures frontend and backend use identical pricing logic.
 *
 * @param productKind - The type of product being purchased
 * @param priceCents - The price in cents (either per-seat or total)
 * @param quantity - The quantity being purchased
 * @returns The subtotal in cents
 *
 * @example
 * // Individual ticket: $500 × 2 = $1,000
 * calculateOrderSubtotal("INDIVIDUAL_TICKET", 50000, 2) // returns 100000
 *
 * @example
 * // Full table: $5,000 (doesn't multiply)
 * calculateOrderSubtotal("FULL_TABLE", 500000, 10) // returns 500000
 */
export function calculateOrderSubtotal(
  productKind: string,
  priceCents: number,
  quantity: number
): number {
  if (productKind === 'FULL_TABLE') {
    return priceCents
  } else {
    return priceCents * quantity
  }
}

/**
 * Get display quantity for UI
 * - FULL_TABLE: Show table capacity (default 10 seats)
 * - Others: Show actual quantity
 *
 * @param productKind - The type of product
 * @param quantity - The order quantity
 * @param tableCapacity - The number of seats in a table (default: 10)
 * @returns The quantity to display in UI
 *
 * @example
 * // Table with 10 seats
 * getDisplayQuantity("FULL_TABLE", 1, 10) // returns 10
 *
 * @example
 * // Individual tickets
 * getDisplayQuantity("INDIVIDUAL_TICKET", 3) // returns 3
 */
export function getDisplayQuantity(
  productKind: string,
  quantity: number,
  tableCapacity: number = 10
): number {
  return productKind === 'FULL_TABLE' ? tableCapacity : quantity
}

/**
 * Get order quantity for backend submission
 * - FULL_TABLE: Always 1 (buying one table)
 * - Others: Actual quantity
 *
 * @param productKind - The type of product
 * @param quantity - The requested quantity
 * @returns The quantity to submit to backend
 *
 * @example
 * // Table purchase (always quantity=1)
 * getOrderQuantity("FULL_TABLE", 10) // returns 1
 *
 * @example
 * // Individual tickets
 * getOrderQuantity("INDIVIDUAL_TICKET", 5) // returns 5
 */
export function getOrderQuantity(
  productKind: string,
  quantity: number
): number {
  return productKind === 'FULL_TABLE' ? 1 : quantity
}

/**
 * Validate quantity based on product kind
 *
 * @param productKind - The type of product
 * @param quantity - The quantity to validate
 * @returns Object with validation result and error message
 *
 * @example
 * validateQuantity("FULL_TABLE", 2)
 * // returns { valid: false, error: "Can only purchase 1 table at a time" }
 *
 * @example
 * validateQuantity("INDIVIDUAL_TICKET", 5)
 * // returns { valid: true }
 */
export function validateQuantity(
  productKind: string,
  quantity: number
): { valid: boolean; error?: string } {
  if (productKind === 'FULL_TABLE') {
    if (quantity !== 1) {
      return {
        valid: false,
        error: 'Can only purchase 1 table at a time',
      }
    }
  } else if (productKind === 'INDIVIDUAL_TICKET') {
    if (quantity < 1 || quantity > 10) {
      return {
        valid: false,
        error: 'Quantity must be between 1 and 10 for individual tickets',
      }
    }
  }

  return { valid: true }
}

/**
 * Format price display text based on product kind
 *
 * @param productKind - The type of product
 * @param priceCents - The price in cents
 * @param quantity - The quantity
 * @returns Formatted display string
 *
 * @example
 * formatPriceDisplay("FULL_TABLE", 500000, 10)
 * // returns "$5,000 (includes 10 seats)"
 *
 * @example
 * formatPriceDisplay("INDIVIDUAL_TICKET", 50000, 2)
 * // returns "$500 × 2"
 */
export function formatPriceDisplay(
  productKind: string,
  priceCents: number,
  quantity: number
): string {
  const priceFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100)

  if (productKind === 'FULL_TABLE') {
    return `${priceFormatted} (includes ${quantity} seats)`
  } else {
    return quantity > 1 ? `${priceFormatted} × ${quantity}` : priceFormatted
  }
}
