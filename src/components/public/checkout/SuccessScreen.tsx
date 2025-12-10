"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, PartyPopper } from "lucide-react"
import { formatCentsToDisplay } from "@/lib/stripe"
import confetti from "canvas-confetti"

interface SuccessScreenProps {
  orderId: string
  ticketType: "STANDARD" | "VIP" | "VVIP"
  quantity: number
  amountCents: number
  buyerEmail: string
  isTable?: boolean
  tableSlug?: string
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
  tableSlug,
}: SuccessScreenProps) {
  const [countdown, setCountdown] = useState(10)

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

  // Countdown to redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Redirect to dashboard
          window.location.href = "/dashboard"
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

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
            <dd className="font-mono text-gray-900">{orderId.slice(-8).toUpperCase()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Tickets</dt>
            <dd className="text-gray-900">
              {quantity}x {tierLabels[ticketType]}
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

      {/* Confirmation Email */}
      <p className="text-sm text-gray-600 mb-6">
        A confirmation email has been sent to{" "}
        <span className="font-medium text-gray-900">{buyerEmail}</span>
      </p>

      {/* Actions */}
      <div className="space-y-3">
        {isTable && tableSlug ? (
          <Link href={`/t/${tableSlug}`}>
            <Button
              className="w-full max-w-xs bg-brand-primary hover:bg-brand-accent text-white"
              size="lg"
            >
              Manage Your Table
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

        <p className="text-xs text-gray-400">
          Redirecting to dashboard in {countdown} seconds...
        </p>
      </div>
    </div>
  )
}
