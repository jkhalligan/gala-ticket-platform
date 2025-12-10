"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, PartyPopper, Loader2 } from "lucide-react"
import { formatCentsToDisplay } from "@/lib/stripe"
import confetti from "canvas-confetti"
import { TableSetupModal } from "@/components/dashboard/TableSetupModal"

interface SuccessScreenProps {
  orderId: string // This may be order ID or payment intent ID
  ticketType: "STANDARD" | "VIP" | "VVIP"
  quantity: number
  amountCents: number
  buyerEmail: string
  isTable?: boolean
  tableSlug?: string
  productKind?: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"
}

interface OrderData {
  id: string
  status: string
  product_kind: string
  table_slug: string | null
  table_name: string | null
}

const tierLabels: Record<string, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  VVIP: "VVIP",
}

export function SuccessScreen({
  orderId,
  ticketType,
  quantity,
  amountCents,
  buyerEmail,
  isTable,
  tableSlug: initialTableSlug,
  productKind: initialProductKind,
}: SuccessScreenProps) {
  const [countdown, setCountdown] = useState(15)
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string>("/dashboard")

  // Determine final values from either props or fetched data
  const tableSlug = orderData?.table_slug || initialTableSlug
  const productKind = orderData?.product_kind || initialProductKind
  const isFullTable = productKind === "FULL_TABLE" || isTable

  // Poll for order completion (webhook creates table async)
  const pollForOrder = useCallback(async () => {
    // If orderId looks like a payment intent (starts with "pi_"), poll by payment intent
    const isPaymentIntent = orderId.startsWith("pi_")

    if (!isPaymentIntent) {
      // We have an actual order ID, just fetch it
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        if (res.ok) {
          const data = await res.json()
          setOrderData({
            id: data.order.id,
            status: data.order.status,
            product_kind: data.order.product?.kind,
            table_slug: data.order.table?.slug || null,
            table_name: data.order.table?.name || null,
          })
          setLoading(false)
        }
      } catch (err) {
        console.error("Error fetching order:", err)
        setLoading(false)
      }
      return
    }

    // Poll by payment intent ID for webhook-processed orders
    let attempts = 0
    const maxAttempts = 20
    const pollInterval = 1000 // 1 second

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/by-payment-intent/${orderId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.order.status === "COMPLETED") {
            setOrderData({
              id: data.order.id,
              status: data.order.status,
              product_kind: data.order.product_kind,
              table_slug: data.order.table_slug,
              table_name: data.order.table_name,
            })
            setLoading(false)
            return
          }
        }
      } catch (err) {
        console.error("Error polling for order:", err)
      }

      attempts++
      if (attempts < maxAttempts) {
        setTimeout(poll, pollInterval)
      } else {
        // Max attempts reached, stop loading but may not have full data
        setLoading(false)
      }
    }

    poll()
  }, [orderId])

  // Start polling on mount
  useEffect(() => {
    pollForOrder()
  }, [pollForOrder])

  // Confetti effect on mount
  useEffect(() => {
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#3b82f6", "#ec4899", "#f59e0b"],
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#3b82f6", "#ec4899", "#f59e0b"],
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  // Determine redirect target based on product type
  useEffect(() => {
    if (isFullTable && tableSlug) {
      setRedirectTarget(`/dashboard/table/${tableSlug}`)
    } else if (productKind === "INDIVIDUAL_TICKET") {
      setRedirectTarget("/dashboard/tickets")
    } else {
      setRedirectTarget("/dashboard")
    }
  }, [isFullTable, tableSlug, productKind])

  // Show setup modal for table purchases after data loaded
  useEffect(() => {
    if (!loading && isFullTable && tableSlug && !showSetupModal) {
      // Delay modal slightly for better UX
      const timer = setTimeout(() => {
        setShowSetupModal(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [loading, isFullTable, tableSlug, showSetupModal])

  // Countdown to redirect (only if setup modal not shown)
  useEffect(() => {
    if (showSetupModal || loading) return // Don't countdown while modal is open

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          window.location.href = redirectTarget
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [redirectTarget, showSetupModal, loading])

  const handleSetupComplete = (newSlug?: string) => {
    setShowSetupModal(false)
    const finalSlug = newSlug || tableSlug
    if (finalSlug) {
      window.location.href = `/dashboard/table/${finalSlug}`
    }
  }

  const handleSetupSkip = () => {
    setShowSetupModal(false)
    if (tableSlug) {
      window.location.href = `/dashboard/table/${tableSlug}`
    }
  }

  return (
    <div className="text-center py-8">
      {/* Success Icon */}
      <div className="mb-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-10 h-10 text-green-600" />
        </div>
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-900">
          <PartyPopper className="w-6 h-6 text-yellow-500" />
          Payment Successful!
          <PartyPopper className="w-6 h-6 text-yellow-500" />
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6 max-w-sm mx-auto">
        <h3 className="font-semibold text-gray-900 mb-4">Order Confirmed</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Order ID</dt>
            <dd className="font-mono text-gray-900">
              {(orderData?.id || orderId).slice(-8).toUpperCase()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">
              {isFullTable ? "Table" : "Tickets"}
            </dt>
            <dd className="text-gray-900">
              {isFullTable
                ? `${tierLabels[ticketType]} Table (${quantity} seats)`
                : `${quantity}x ${tierLabels[ticketType]}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Total Paid</dt>
            <dd className="font-semibold text-gray-900">
              {formatCentsToDisplay(amountCents)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Loading indicator while waiting for webhook */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Setting up your {isFullTable ? "table" : "tickets"}...</span>
        </div>
      )}

      {/* Confirmation Email */}
      <p className="text-sm text-gray-600 mb-6">
        A confirmation email has been sent to{" "}
        <span className="font-medium text-gray-900">{buyerEmail}</span>
      </p>

      {/* Actions */}
      <div className="space-y-3">
        {isFullTable && tableSlug ? (
          <Link href={`/dashboard/table/${tableSlug}`}>
            <Button
              className="w-full max-w-xs bg-brand-primary hover:bg-brand-accent text-white"
              size="lg"
            >
              Manage Your Table
            </Button>
          </Link>
        ) : productKind === "INDIVIDUAL_TICKET" ? (
          <Link href="/dashboard/tickets">
            <Button
              className="w-full max-w-xs bg-brand-primary hover:bg-brand-accent text-white"
              size="lg"
            >
              View Your Tickets
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard">
            <Button
              className="w-full max-w-xs bg-brand-primary hover:bg-brand-accent text-white"
              size="lg"
            >
              Go to Dashboard
            </Button>
          </Link>
        )}

        {!showSetupModal && (
          <p className="text-xs text-gray-400">
            Redirecting in {countdown} seconds...
          </p>
        )}
      </div>

      {/* Table Setup Modal */}
      {showSetupModal && tableSlug && (
        <TableSetupModal
          tableSlug={tableSlug}
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}
    </div>
  )
}
