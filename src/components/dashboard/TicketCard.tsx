"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  QrCode,
  Edit,
  Send,
  Utensils,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

interface TicketData {
  id: string
  tier: string
  display_name: string | null
  dietary_restrictions: string | null
  checked_in_at: string | null
  reference_code: string | null
  event: {
    id: string
    name: string
    event_date: string
    venue_name: string | null
  }
  table: {
    id: string
    name: string
    slug: string
  } | null
}

interface TicketCardProps {
  ticket: TicketData
  userName: string
}

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  STANDARD: { bg: "bg-gray-500", text: "text-white", border: "border-gray-500" },
  VIP: { bg: "bg-purple-600", text: "text-white", border: "border-purple-600" },
  VVIP: { bg: "bg-amber-500", text: "text-white", border: "border-amber-500" },
}

const tierLabels: Record<string, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  VVIP: "VVIP",
}

export function TicketCard({ ticket, userName }: TicketCardProps) {
  const [showQR, setShowQR] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const tierStyle = tierColors[ticket.tier] || tierColors.STANDARD
  const tierLabel = tierLabels[ticket.tier] || ticket.tier
  const displayName = ticket.display_name || userName

  return (
    <Card className="overflow-hidden">
      {/* Tier Banner */}
      <div className={`${tierStyle.bg} ${tierStyle.text} px-4 py-2`}>
        <div className="flex items-center justify-between">
          <p className="font-semibold">{tierLabel} Ticket</p>
          {ticket.checked_in_at && (
            <Badge variant="secondary" className="bg-white/20 text-white">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Checked In
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Guest Name */}
        <div>
          <p className="text-sm text-gray-500">Guest Name</p>
          <p className="font-medium text-gray-900">{displayName}</p>
        </div>

        {/* Table Assignment */}
        {ticket.table && (
          <div>
            <p className="text-sm text-gray-500">Table Assignment</p>
            <Button
              variant="link"
              className="p-0 h-auto font-medium text-brand-primary"
              asChild
            >
              <Link href={`/dashboard/table/${ticket.table.slug}`}>
                {ticket.table.name}
              </Link>
            </Button>
          </div>
        )}

        {/* Dietary Restrictions (collapsible on mobile) */}
        {ticket.dietary_restrictions && (
          <div className="flex items-start gap-2 text-sm">
            <Utensils className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-gray-500">Dietary Restrictions</p>
              <p className="text-gray-700">{ticket.dietary_restrictions}</p>
            </div>
          </div>
        )}

        {/* Reference Code */}
        {ticket.reference_code && (
          <div>
            <p className="text-sm text-gray-500">Reference Code</p>
            <p className="font-mono text-lg text-gray-900">{ticket.reference_code}</p>
          </div>
        )}

        {/* QR Code Toggle */}
        <div className="pt-2">
          {showQR ? (
            <div className="space-y-3">
              <div className="flex justify-center py-4 bg-white rounded-lg border">
                <QRCodeSVG
                  value={ticket.reference_code || ticket.id}
                  size={150}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-center text-gray-500">
                Show this code at check-in
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowQR(false)}
              >
                <ChevronUp className="w-4 h-4 mr-2" />
                Hide QR Code
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Show QR Code
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button variant="ghost" size="sm" className="flex-1">
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <Send className="w-4 h-4 mr-2" />
            Transfer
          </Button>
        </div>
      </div>
    </Card>
  )
}
