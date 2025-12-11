// Component: CaptainNudgeCard
// Nudge card for captain to purchase their own seat

"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface CaptainNudgeCardProps {
  onBuyTicket: () => void
}

export function CaptainNudgeCard({ onBuyTicket }: CaptainNudgeCardProps) {
  return (
    <Alert className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Don't forget your ticket, Captain!</AlertTitle>
      <AlertDescription>
        Lead by example and secure your seat at the table.
        <Button
          size="sm"
          className="mt-2"
          onClick={onBuyTicket}
        >
          Buy My Ticket
        </Button>
      </AlertDescription>
    </Alert>
  )
}
