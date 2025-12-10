"use client"

import { useState } from "react"
import { ProgressIndicator } from "./ProgressIndicator"
import { OrderSummary } from "./OrderSummary"
import { Step1_BuyerInfo } from "./Step1_BuyerInfo"
import { Step2_GuestChoice } from "./Step2_GuestChoice"
import { Step3_GuestDetails } from "./Step3_GuestDetails"
import { Step4_Payment } from "./Step4_Payment"
import { SuccessScreen } from "./SuccessScreen"

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
    quantity: format === "table" ? 10 : quantity,
    pricePerTicket,
    eventId,
    productId,
    buyer: { email: "", firstName: "", lastName: "", phone: "" },
    guestChoice: null,
    guests: [],
    tableInfo: undefined,
  })

  // Calculate actual quantity for pricing
  const actualQuantity = format === "table" ? 10 : data.quantity
  const amountCents = pricePerTicket * actualQuantity

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
              quantity={actualQuantity}
              onNext={handleGuestChoiceNext}
              onBack={prevStep}
            />
          )}

          {step === 3 && (
            <Step3_GuestDetails
              initialGuests={data.guests}
              quantity={actualQuantity}
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
                quantity: actualQuantity,
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
              quantity={actualQuantity}
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
              format={data.format}
              quantity={actualQuantity}
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
