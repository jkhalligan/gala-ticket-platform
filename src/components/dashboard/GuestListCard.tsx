"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Check,
  ShoppingCart,
  Edit,
  Trash2,
  User,
  Utensils,
  CheckCircle2,
} from "lucide-react"
import { ClaimSeatModal } from "./ClaimSeatModal"

interface Guest {
  id: string
  user_id: string
  display_name: string | null
  dietary_restrictions: string | null
  checked_in_at: string | null
  reference_code: string | null
  user: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    full_name: string
  }
  is_self_pay: boolean
  can_edit: boolean
  can_remove: boolean
}

interface GuestListCardProps {
  tableId: string
  tableSlug: string
  tableType: "PREPAID" | "CAPTAIN_PAYG"
  capacity: number
  guests: Guest[]
  placeholderSeats: number
  canEdit: boolean
  currentUserId?: string
}

export function GuestListCard({
  tableId,
  tableSlug,
  tableType,
  capacity,
  guests,
  placeholderSeats,
  canEdit,
  currentUserId,
}: GuestListCardProps) {
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)

  const isPrepaid = tableType === "PREPAID"
  const isCaptain = tableType === "CAPTAIN_PAYG"

  // Build array of all seats (filled + placeholder + empty)
  const totalFilledAndPlaceholder = guests.length + placeholderSeats
  const emptySeats = Math.max(0, capacity - totalFilledAndPlaceholder)

  const handleClaimSeat = (seatNumber: number) => {
    setSelectedSeat(seatNumber)
    setShowClaimModal(true)
  }

  const handlePurchaseSeat = () => {
    // Redirect to checkout for this table
    window.location.href = `/checkout?table=${tableSlug}&type=table`
  }

  const handleClaimSuccess = () => {
    setShowClaimModal(false)
    setSelectedSeat(null)
    // Refresh the page to show updated data
    window.location.reload()
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Guest List</h2>
          {canEdit && isPrepaid && placeholderSeats > 0 && (
            <Button size="sm" onClick={() => handleClaimSeat(guests.length + 1)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Guest
            </Button>
          )}
        </div>

        {/* Desktop: Table Layout */}
        <div className="hidden md:block">
          <div className="grid grid-cols-2 gap-4">
            {/* Filled Seats */}
            {guests.map((guest, index) => (
              <SeatCard
                key={guest.id}
                seatNumber={index + 1}
                guest={guest}
                canEdit={guest.can_edit}
                canRemove={guest.can_remove}
                isCurrentUser={guest.user_id === currentUserId}
              />
            ))}

            {/* Placeholder Seats (purchased but not assigned) */}
            {Array.from({ length: placeholderSeats }).map((_, index) => (
              <PlaceholderSeatCard
                key={`placeholder-${index}`}
                seatNumber={guests.length + index + 1}
                isPrepaid={isPrepaid}
                onClaim={() => handleClaimSeat(guests.length + index + 1)}
              />
            ))}

            {/* Empty Seats (not yet purchased - only for CAPTAIN_PAYG) */}
            {isCaptain &&
              Array.from({ length: emptySeats }).map((_, index) => (
                <EmptySeatCard
                  key={`empty-${index}`}
                  seatNumber={guests.length + placeholderSeats + index + 1}
                  onPurchase={handlePurchaseSeat}
                />
              ))}
          </div>
        </div>

        {/* Mobile: List Layout */}
        <div className="md:hidden space-y-3">
          {/* Filled Seats */}
          {guests.map((guest, index) => (
            <SeatCardMobile
              key={guest.id}
              seatNumber={index + 1}
              guest={guest}
              canEdit={guest.can_edit}
              canRemove={guest.can_remove}
              isCurrentUser={guest.user_id === currentUserId}
            />
          ))}

          {/* Placeholder Seats */}
          {Array.from({ length: placeholderSeats }).map((_, index) => (
            <PlaceholderSeatCardMobile
              key={`placeholder-${index}`}
              seatNumber={guests.length + index + 1}
              isPrepaid={isPrepaid}
              onClaim={() => handleClaimSeat(guests.length + index + 1)}
            />
          ))}

          {/* Empty Seats - CAPTAIN_PAYG only */}
          {isCaptain &&
            Array.from({ length: emptySeats }).map((_, index) => (
              <EmptySeatCardMobile
                key={`empty-${index}`}
                seatNumber={guests.length + placeholderSeats + index + 1}
                onPurchase={handlePurchaseSeat}
              />
            ))}
        </div>

        {guests.length === 0 && placeholderSeats === 0 && emptySeats === 0 && (
          <div className="text-center py-8 text-gray-500">
            No seats available
          </div>
        )}
      </Card>

      {/* Claim Seat Modal */}
      {showClaimModal && (
        <ClaimSeatModal
          tableId={tableId}
          tableSlug={tableSlug}
          seatNumber={selectedSeat || 1}
          onClose={() => {
            setShowClaimModal(false)
            setSelectedSeat(null)
          }}
          onSuccess={handleClaimSuccess}
        />
      )}
    </>
  )
}

// Desktop Seat Card - Filled
function SeatCard({
  seatNumber,
  guest,
  canEdit,
  canRemove,
  isCurrentUser,
}: {
  seatNumber: number
  guest: Guest
  canEdit: boolean
  canRemove: boolean
  isCurrentUser: boolean
}) {
  return (
    <div
      className={`border rounded-lg p-4 hover:border-brand-primary/50 transition ${
        isCurrentUser ? "bg-brand-primary/5 border-brand-primary/30" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
            {seatNumber}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {guest.display_name || guest.user.full_name}
            </p>
            <p className="text-sm text-gray-500 truncate">{guest.user.email}</p>
          </div>
        </div>

        {guest.checked_in_at && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Checked In
          </Badge>
        )}
      </div>

      {/* Guest details */}
      {guest.dietary_restrictions && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Utensils className="w-4 h-4" />
          <span>{guest.dietary_restrictions}</span>
        </div>
      )}

      {/* Actions */}
      {(canEdit || canRemove) && (
        <div className="mt-3 flex gap-2">
          {canEdit && (
            <Button variant="ghost" size="sm" className="h-8">
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Desktop - Placeholder Seat
function PlaceholderSeatCard({
  seatNumber,
  isPrepaid,
  onClaim,
}: {
  seatNumber: number
  isPrepaid: boolean
  onClaim: () => void
}) {
  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500">
            {seatNumber}
          </div>
          <p className="text-gray-500">Awaiting guest details</p>
        </div>

        {isPrepaid && (
          <Button size="sm" variant="outline" onClick={onClaim}>
            <Check className="w-4 h-4 mr-2" />
            Claim Seat
          </Button>
        )}
      </div>
    </div>
  )
}

// Desktop - Empty Seat (CAPTAIN_PAYG)
function EmptySeatCard({
  seatNumber,
  onPurchase,
}: {
  seatNumber: number
  onPurchase: () => void
}) {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-400">
            {seatNumber}
          </div>
          <p className="text-gray-400">Empty Seat</p>
        </div>

        <Button size="sm" onClick={onPurchase}>
          <ShoppingCart className="w-4 h-4 mr-2" />
          Purchase Seat
        </Button>
      </div>
    </div>
  )
}

// Mobile versions
function SeatCardMobile({
  seatNumber,
  guest,
  canEdit,
  canRemove,
  isCurrentUser,
}: {
  seatNumber: number
  guest: Guest
  canEdit: boolean
  canRemove: boolean
  isCurrentUser: boolean
}) {
  return (
    <Card
      className={`p-4 ${isCurrentUser ? "bg-brand-primary/5 border-brand-primary/30" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
            {seatNumber}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {guest.display_name || guest.user.full_name}
            </p>
            <p className="text-sm text-gray-500 truncate">{guest.user.email}</p>
            {guest.dietary_restrictions && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Utensils className="w-3 h-3" />
                {guest.dietary_restrictions}
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        )}
      </div>
    </Card>
  )
}

function PlaceholderSeatCardMobile({
  seatNumber,
  isPrepaid,
  onClaim,
}: {
  seatNumber: number
  isPrepaid: boolean
  onClaim: () => void
}) {
  return (
    <Card className="p-4 border-dashed bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0">
            {seatNumber}
          </div>
          <p className="text-gray-500">Awaiting details</p>
        </div>

        {isPrepaid && (
          <Button size="sm" variant="outline" onClick={onClaim}>
            Claim
          </Button>
        )}
      </div>
    </Card>
  )
}

function EmptySeatCardMobile({
  seatNumber,
  onPurchase,
}: {
  seatNumber: number
  onPurchase: () => void
}) {
  return (
    <Card className="p-4 border-dashed">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-400 shrink-0">
            {seatNumber}
          </div>
          <p className="text-gray-400">Empty</p>
        </div>

        <Button size="sm" onClick={onPurchase}>
          Buy
        </Button>
      </div>
    </Card>
  )
}
