"use client"

import { cn } from "@/lib/utils"

export type Tier = "STANDARD" | "VIP" | "VVIP"

interface TierToggleProps {
  value: Tier
  onChange: (tier: Tier) => void
}

const tierLabels: Record<Tier, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  VVIP: "VVIP",
}

export function TierToggle({ value, onChange }: TierToggleProps) {
  const tiers: Tier[] = ["STANDARD", "VIP", "VVIP"]

  return (
    <div className="flex justify-center mb-12">
      <div
        className="inline-flex bg-gray-100 rounded-lg p-1"
        role="tablist"
        aria-label="Ticket tier selection"
      >
        {tiers.map((tier) => (
          <button
            key={tier}
            onClick={() => onChange(tier)}
            role="tab"
            aria-selected={value === tier}
            className={cn(
              "px-6 py-2 rounded-md text-sm font-medium transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
              value === tier
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {tierLabels[tier]}
          </button>
        ))}
      </div>
    </div>
  )
}
