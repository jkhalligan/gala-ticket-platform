"use client"

import { useState, useEffect } from "react"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { getStripePromise, formatCentsToDisplay } from "@/lib/stripe"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface CheckoutData {
  eventId: string
  productId: string
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  quantity: number
  buyer: {
    email: string
    firstName: string
    lastName: string
    phone: string
  }
  tableInfo?: {
    name: string
    internalName?: string
  }
}

interface Step4Props {
  data: CheckoutData
  amountCents: number
  onSuccess: (orderId: string) => void
  onBack: () => void
}

export function Step4_Payment({ data, amountCents, onSuccess, onBack }: Step4Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Create payment intent on mount
    const createPaymentIntent = async () => {
      try {
        setLoading(true)
        setError(null)

        const orderFlow = data.format === "table"
          ? (data.tableInfo ? "full_table" : "captain_commitment")
          : "individual"

        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: data.eventId,
            product_id: data.productId,
            order_flow: orderFlow,
            quantity: data.quantity,
            buyer_info: {
              email: data.buyer.email,
              first_name: data.buyer.firstName,
              last_name: data.buyer.lastName,
              phone: data.buyer.phone,
            },
            table_info: data.tableInfo
              ? {
                  name: data.tableInfo.name,
                  internal_name: data.tableInfo.internalName,
                }
              : undefined,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Failed to create payment")
        }

        if (result.requires_payment && result.client_secret) {
          setClientSecret(result.client_secret)
        } else if (!result.requires_payment && result.order_id) {
          // $0 order - skip payment
          onSuccess(result.order_id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }

    createPaymentIntent()
  }, [data, onSuccess])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-4" />
        <p className="text-gray-600">Preparing payment...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
        <Button variant="outline" onClick={onBack} className="w-full" size="lg">
          Go Back
        </Button>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No payment required</p>
      </div>
    )
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "hsl(221.2 83.2% 53.3%)",
            colorBackground: "#ffffff",
            colorText: "#1f2937",
            colorDanger: "#ef4444",
            fontFamily: "system-ui, sans-serif",
            borderRadius: "8px",
          },
        },
      }}
    >
      <PaymentForm
        amountCents={amountCents}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  )
}

function PaymentForm({
  amountCents,
  onSuccess,
  onBack,
}: {
  amountCents: number
  onSuccess: (orderId: string) => void
  onBack: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError(null)

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    })

    if (submitError) {
      setError(submitError.message || "Payment failed")
      setLoading(false)
      return
    }

    if (paymentIntent?.status === "succeeded") {
      // Payment successful - the webhook will create the order
      // For now, we'll show success immediately
      onSuccess(paymentIntent.id)
    } else {
      setError("Payment was not successful. Please try again.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Payment</h2>
        <p className="text-sm text-gray-500">
          Complete your purchase securely with Stripe
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-brand-primary hover:bg-brand-accent text-white"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            `Pay ${formatCentsToDisplay(amountCents)}`
          )}
        </Button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        By completing this purchase, you agree to our terms of service.
      </p>
    </form>
  )
}
