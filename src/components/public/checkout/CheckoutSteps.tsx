"use client"

import { useState } from "react"
import { ProgressIndicator } from "./ProgressIndicator"
import { OrderSummary } from "./OrderSummary"
import { Step1_BuyerInfo } from "./Step1_BuyerInfo"
import { Step2_GuestChoice } from "./Step2_GuestChoice"
import { Step3_GuestDetails } from "./Step3_GuestDetails"
import { Step4_Payment } from "./Step4_Payment"
import { SuccessScreen } from "./SuccessScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Minus } from "lucide-react"

type CheckoutStep = 1 | 2 | 3 | 4 | "success"

interface BuyerInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
}

interface GuestInfo {
  name: string
  email: string
  dietaryRestrictions: string[]
}

interface CheckoutData {
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  mode?: "host" | "captain"
  quantity: number
  pricePerTicket: number
  eventId: string
  productId: string
  buyer: BuyerInfo
  guestChoice: "enter-now" | "send-later" | null
  guests: GuestInfo[]
  tableInfo?: {
    name: string
    internalName?: string
  }
}

interface CheckoutStepsProps {
  eventId: string
  productId: string
  productKind: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"
  ticketType: "STANDARD" | "VIP" | "VVIP"
  format: "individual" | "table"
  mode?: "host" | "captain"
  quantity?: number
  pricePerTicket: number
  eventName?: string
  eventDate?: string
}

export function CheckoutSteps({
  eventId,
  productId,
  productKind,
  ticketType,
  format,
  mode,
  quantity = 1,
  pricePerTicket,
  eventName,
  eventDate,
}: CheckoutStepsProps) {
  const [step, setStep] = useState<CheckoutStep>(1)
  const [orderId, setOrderId] = useState<string | null>(null)

  const [data, setData] = useState<CheckoutData>({
    ticketType,
    format,
    mode,
    // For FULL_TABLE, quantity must be 1 (price includes all seats)
    // For individual tickets, use provided quantity
    quantity: productKind === "FULL_TABLE" ? 1 : quantity,
    pricePerTicket,
    eventId,
    productId,
    buyer: { email: "", firstName: "", lastName: "", phone: "" },
    guestChoice: null,
    guests: [],
    tableInfo: undefined,
  })

  // Calculate amount based on product kind (matches backend logic)
  let amountCents: number
  let displayQuantity: number

  if (productKind === "FULL_TABLE") {
    // For full tables, price_cents is the TOTAL (don't multiply)
    amountCents = pricePerTicket
    displayQuantity = 10 // For display purposes only (seats included)
  } else {
    // For individual tickets, multiply by quantity
    displayQuantity = data.quantity
    amountCents = pricePerTicket * displayQuantity
  }

  const nextStep = () => {
    if (step === 2 && data.guestChoice === "send-later") {
      setStep(4) // Skip guest details
    } else if (typeof step === "number" && step < 4) {
      setStep((step + 1) as CheckoutStep)
    }
  }

  const prevStep = () => {
    if (typeof step === "number" && step > 1) {
      if (step === 4 && data.guestChoice === "send-later") {
        setStep(2) // Skip back over step 3
      } else {
        setStep((step - 1) as CheckoutStep)
      }
    }
  }

  const handleBuyerInfoNext = (buyerData: BuyerInfo) => {
    setData((prev) => ({ ...prev, buyer: buyerData }))
    nextStep()
  }

  const handleGuestChoiceNext = (choice: "enter-now" | "send-later") => {
    setData((prev) => ({ ...prev, guestChoice: choice }))
    if (choice === "send-later") {
      setStep(4)
    } else {
      setStep(3)
    }
  }

  const handleGuestDetailsNext = (guests: GuestInfo[]) => {
    setData((prev) => ({ ...prev, guests }))
    nextStep()
  }

  const handlePaymentSuccess = (newOrderId: string) => {
    setOrderId(newOrderId)
    setStep("success")
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Main content */}
      <div className="lg:col-span-2">
        {step !== "success" && (
          <ProgressIndicator
            currentStep={step}
            guestChoiceSkipped={data.guestChoice === "send-later"}
          />
        )}

        {/* Quantity Selector - Show before starting checkout */}
        {step === 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            {productKind === "INDIVIDUAL_TICKET" ? (
              <div className="space-y-3">
                <Label htmlFor="quantity" className="text-base font-medium">
                  Number of Tickets
                </Label>

                <div className="flex items-center gap-3">
                  {/* Decrement Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newQty = Math.max(1, data.quantity - 1)
                      setData({ ...data, quantity: newQty })
                    }}
                    disabled={data.quantity <= 1}
                    aria-label="Decrease quantity"
                    className="h-10 w-10 md:h-9 md:w-9"
                  >
                    <Minus className="h-5 w-5 md:h-4 md:w-4" />
                  </Button>

                  {/* Numeric Input */}
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={10}
                    value={data.quantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (!isNaN(value) && value >= 1 && value <= 10) {
                        setData({ ...data, quantity: value })
                      }
                    }}
                    className="w-20 md:w-24 text-center text-lg md:text-base"
                    aria-describedby="quantity-description"
                    aria-label="Number of tickets to purchase"
                  />

                  {/* Increment Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newQty = Math.min(10, data.quantity + 1)
                      setData({ ...data, quantity: newQty })
                    }}
                    disabled={data.quantity >= 10}
                    aria-label="Increase quantity"
                    className="h-10 w-10 md:h-9 md:w-9"
                  >
                    <Plus className="h-5 w-5 md:h-4 md:w-4" />
                  </Button>
                </div>

                <p
                  id="quantity-description"
                  className="text-sm text-muted-foreground"
                >
                  Select between 1 and 10 tickets
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium text-gray-900">Table Purchase</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You are purchasing 1 table that includes 10 seats
                </p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {step === 1 && (
            <Step1_BuyerInfo
              initialData={data.buyer}
              onNext={handleBuyerInfoNext}
            />
          )}

          {step === 2 && (
            <Step2_GuestChoice
              initialChoice={data.guestChoice}
              quantity={displayQuantity}
              onNext={handleGuestChoiceNext}
              onBack={prevStep}
            />
          )}

          {step === 3 && (
            <Step3_GuestDetails
              initialGuests={data.guests}
              quantity={displayQuantity}
              buyerInfo={data.buyer}
              onNext={handleGuestDetailsNext}
              onBack={prevStep}
            />
          )}

          {step === 4 && (
            <Step4_Payment
              data={{
                eventId: data.eventId,
                productId: data.productId,
                ticketType: data.ticketType,
                format: data.format,
                quantity: data.quantity,
                buyer: data.buyer,
                tableInfo: data.tableInfo,
              }}
              amountCents={amountCents}
              onSuccess={handlePaymentSuccess}
              onBack={prevStep}
            />
          )}

          {step === "success" && orderId && (
            <SuccessScreen
              orderId={orderId}
              ticketType={data.ticketType}
              quantity={displayQuantity}
              amountCents={amountCents}
              buyerEmail={data.buyer.email}
              isTable={data.format === "table"}
            />
          )}
        </div>
      </div>

      {/* Order Summary Sidebar */}
      {step !== "success" && (
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-8">
            <OrderSummary
              ticketType={data.ticketType}
              productKind={productKind}
              format={data.format}
              quantity={displayQuantity}
              pricePerTicket={pricePerTicket}
              eventName={eventName}
              eventDate={eventDate}
            />
          </div>
        </div>
      )}
    </div>
  )
}
