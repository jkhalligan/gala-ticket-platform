// Component: GuestStatusBadge
// Shows guest status with appropriate badge styling

import { Badge } from "@/components/ui/badge"
import { Crown, Star, Check } from "lucide-react"

interface GuestStatusBadgeProps {
  role?: 'CAPTAIN' | 'HOST' | 'OWNER'
  isPaid?: boolean
  tableType: 'PREPAID' | 'CAPTAIN_PAYG'
}

export function GuestStatusBadge({ role, isPaid, tableType }: GuestStatusBadgeProps) {
  // Role badges (highest priority)
  if (role === 'CAPTAIN') {
    return (
      <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">
        <Star className="w-3 h-3 mr-1" />
        Captain
      </Badge>
    )
  }

  if (role === 'HOST' || role === 'OWNER') {
    return (
      <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
        <Crown className="w-3 h-3 mr-1" />
        Host
      </Badge>
    )
  }

  // Payment status badges
  if (tableType === 'CAPTAIN_PAYG') {
    if (isPaid) {
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <Check className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
        ○ Unpaid
      </Badge>
    )
  }

  // PREPAID table shows "Confirmed" for paid guests
  if (isPaid) {
    return (
      <Badge variant="secondary">
        <Check className="w-3 h-3 mr-1" />
        Confirmed
      </Badge>
    )
  }

  return (
    <Badge variant="outline">
      ○ No Card
    </Badge>
  )
}
