"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

type CheckoutStep = 1 | 2 | 3 | 4 | "success"

interface ProgressIndicatorProps {
  currentStep: CheckoutStep
  guestChoiceSkipped?: boolean
}

const steps = [
  { number: 1, label: "Your Info" },
  { number: 2, label: "Guest Details" },
  { number: 3, label: "Review" },
  { number: 4, label: "Payment" },
]

export function ProgressIndicator({ currentStep, guestChoiceSkipped }: ProgressIndicatorProps) {
  // Filter steps if guest details are skipped
  const displaySteps = guestChoiceSkipped
    ? steps.filter((s) => s.number !== 3)
    : steps

  const currentStepNum = currentStep === "success" ? 5 : currentStep

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {displaySteps.map((step, index) => {
          const isCompleted = currentStepNum > step.number
          const isCurrent = currentStepNum === step.number
          const isLast = index === displaySteps.length - 1

          return (
            <div key={step.number} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    isCompleted && "bg-brand-primary text-white",
                    isCurrent && "bg-brand-primary text-white ring-4 ring-brand-secondary",
                    !isCompleted && !isCurrent && "bg-gray-200 text-gray-500"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCurrent ? "text-gray-900" : "text-gray-500"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-1.5rem]",
                    isCompleted ? "bg-brand-primary" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
