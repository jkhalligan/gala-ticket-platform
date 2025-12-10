"use client"

import { formatCentsToDisplay } from "@/lib/stripe"

interface OrderSummaryProps {
  ticketType: "STANDARD" | "VIP" | "VVIP"
  productKind: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"
  format: "individual" | "table"
  quantity: number
  pricePerTicket: number
  discountCents?: number
  promoCode?: string
  eventName?: string
  eventDate?: string
}

const tierLabels: Record<string, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  VVIP: "VVIP",
}

export function OrderSummary({
  ticketType,
  productKind,
  format,
  quantity,
  pricePerTicket,
  discountCents = 0,
  promoCode,
  eventName = "Pink Gala 50th Anniversary",
  eventDate = "February 22, 2025",
}: OrderSummaryProps) {
  // Calculate subtotal based on product kind (matches backend logic)
  const subtotal = productKind === "FULL_TABLE"
    ? pricePerTicket
    : pricePerTicket * quantity

  const total = Math.max(0, subtotal - discountCents)
  const isTable = format === "table"

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>

      {/* Event Info */}
      <div className="pb-4 border-b border-gray-200 mb-4">
        <p className="font-medium text-gray-900">{eventName}</p>
        <p className="text-sm text-gray-500">{eventDate}</p>
      </div>

      {/* Line Items */}
      <div className="space-y-3 pb-4 border-b border-gray-200 mb-4">
        <div className="flex justify-between">
          <div>
            <p className="text-gray-900">
              {tierLabels[ticketType]} {isTable ? "Table" : "Ticket"}
            </p>
            <p className="text-sm text-gray-500">
              {isTable
                ? `Table of ${quantity} seats`
                : quantity > 1
                  ? `${quantity} tickets`
                  : "1 ticket"}
            </p>
          </div>
          <p className="text-gray-900">{formatCentsToDisplay(subtotal)}</p>
        </div>

        {discountCents > 0 && (
          <div className="flex justify-between text-green-600">
            <p>
              Discount
              {promoCode && <span className="text-sm"> ({promoCode})</span>}
            </p>
            <p>-{formatCentsToDisplay(discountCents)}</p>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center">
        <p className="text-lg font-semibold text-gray-900">Total</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatCentsToDisplay(total)}
        </p>
      </div>

      {/* Security Note */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Secure checkout powered by Stripe</span>
        </div>
      </div>
    </div>
  )
}
