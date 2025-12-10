"use client"

import { useState } from "react"
import { TierToggle, type Tier } from "./TierToggle"
import { PricingCard } from "./PricingCard"

interface TierData {
  type: Tier
  price: number
  perks: string[]
}

interface PricingCardGridProps {
  tiers: TierData[]
  eventSlug?: string
}

export function PricingCardGrid({ tiers, eventSlug = "pink-gala-50th" }: PricingCardGridProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>("VIP")

  // Find current tier pricing
  const currentTier = tiers.find((t) => t.type === selectedTier) || tiers[0]
  const tierPrice = currentTier?.price ?? 0

  // Define pricing options based on selected tier
  const options = [
    {
      title: "Individual Ticket",
      price: tierPrice,
      description: "per person",
      features: currentTier?.perks ?? [],
      cta: "Purchase Ticket",
      href: `/checkout?event=${eventSlug}&tier=${selectedTier}&type=individual`,
      highlighted: false,
    },
    {
      title: "Full Table",
      price: tierPrice * 10,
      description: "Host 10 Guests",
      features: [
        "Reserved table for 10",
        "Company name signage",
        "Single payment invoice",
        "Pre-paid for all guests",
        ...(currentTier?.perks ?? []),
      ],
      cta: "Buy Table",
      href: `/checkout?event=${eventSlug}&tier=${selectedTier}&type=table&mode=host`,
      highlighted: true,
    },
    {
      title: "Table Captain",
      price: "$0 Commit",
      description: "Recruit 9 friends",
      features: [
        "Secure a table now",
        "Pay only for your seat later",
        "Get a personal invite link",
        "Track fills in real-time",
        ...(currentTier?.perks ?? []),
      ],
      cta: "Start a Table",
      href: `/checkout?event=${eventSlug}&tier=${selectedTier}&type=table&mode=captain`,
      highlighted: false,
      badge: "NEW",
    },
  ]

  return (
    <div className="container mx-auto px-4 pb-16">
      <TierToggle value={selectedTier} onChange={setSelectedTier} />

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {options.map((option, i) => (
          <PricingCard key={i} {...option} />
        ))}
      </div>
    </div>
  )
}
