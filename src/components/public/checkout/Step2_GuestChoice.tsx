"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Users, Mail } from "lucide-react"

type GuestChoice = "enter-now" | "send-later"

interface Step2Props {
  initialChoice: GuestChoice | null
  quantity: number
  onNext: (choice: GuestChoice) => void
  onBack: () => void
}

export function Step2_GuestChoice({
  initialChoice,
  quantity,
  onNext,
  onBack,
}: Step2Props) {
  const [choice, setChoice] = useState<GuestChoice | null>(initialChoice)

  const handleContinue = () => {
    if (choice) {
      onNext(choice)
    }
  }

  const isSingleTicket = quantity === 1

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Guest Details
        </h2>
        <p className="text-sm text-gray-500">
          {isSingleTicket
            ? "Would you like to add your guest information now?"
            : `You have ${quantity} seats. How would you like to handle guest details?`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Option 1: Enter Now */}
        <button
          type="button"
          onClick={() => setChoice("enter-now")}
          className={cn(
            "relative p-6 rounded-lg border-2 text-left transition-all hover:shadow-md",
            choice === "enter-now"
              ? "border-brand-primary bg-brand-secondary"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-3 rounded-full",
                choice === "enter-now"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Enter details now
              </h3>
              <p className="text-sm text-gray-500">
                {isSingleTicket
                  ? "Add dietary preferences and other details for check-in"
                  : "Provide names and emails for all guests upfront"}
              </p>
            </div>
          </div>
          {choice === "enter-now" && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </button>

        {/* Option 2: Send Later */}
        <button
          type="button"
          onClick={() => setChoice("send-later")}
          className={cn(
            "relative p-6 rounded-lg border-2 text-left transition-all hover:shadow-md",
            choice === "send-later"
              ? "border-brand-primary bg-brand-secondary"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-3 rounded-full",
                choice === "send-later"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">
                Send invite links later
              </h3>
              <p className="text-sm text-gray-500">
                {isSingleTicket
                  ? "Skip for now and complete your profile from the dashboard"
                  : "Guests receive magic links to fill in their own details"}
              </p>
            </div>
          </div>
          {choice === "send-later" && (
            <div className="absolute top-3 right-3 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </button>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!choice}
          className="flex-1 bg-brand-primary hover:bg-brand-accent text-white"
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
