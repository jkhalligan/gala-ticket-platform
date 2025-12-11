"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Share2,
  Edit,
  ArrowLeft,
  Copy,
  Check,
  Plus,
  Calendar,
  MapPin,
} from "lucide-react"
import { GuestListCard } from "./GuestListCard"
import { InviteLinkCard } from "./InviteLinkCard"
import { HostMessageCard } from "./HostMessageCard"
import { CaptainNudgeCard } from "./CaptainNudgeCard"
import { TableStatusCard } from "./TableStatusCard"
import { TotalImpactCard } from "./TotalImpactCard"
import { CelebrateButton } from "./CelebrateButton"
import { getTableThemeVars } from "@/lib/table-theme"

interface TableData {
  id: string
  name: string
  slug: string
  type: "PREPAID" | "CAPTAIN_PAYG"
  status: string
  capacity: number
  welcome_message: string | null
  reference_code: string | null
  event: {
    id: string
    name: string
    event_date: string
    venue_name: string | null
  }
  primary_owner: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    full_name: string
  }
}

interface Stats {
  capacity: number
  total_purchased: number
  filled_seats: number
  placeholder_seats: number
  empty_seats: number
  fill_percentage: number
}

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

interface CurrentUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  isAdmin: boolean
}

interface TableDashboardProps {
  table: TableData
  stats: Stats
  guests: Guest[]
  currentUser: CurrentUser | null
  userRole: string | null
  isOwner: boolean
  isGuest: boolean
  canEdit: boolean
  totalRaisedCents: number
  organizationName: string
}

export function TableDashboard({
  table,
  stats,
  guests,
  currentUser,
  userRole,
  isOwner,
  isGuest,
  canEdit,
  totalRaisedCents,
  organizationName,
}: TableDashboardProps) {
  const isPrepaid = table.type === "PREPAID"
  const isCaptain = table.type === "CAPTAIN_PAYG"

  // Check if captain has purchased their own seat
  const captainGuest = guests.find(g => g.user_id === table.primary_owner.id)
  const captainHasPaid = !!captainGuest
  const showCaptainNudge = isCaptain && isOwner && !captainHasPaid

  // Handler for buying captain's ticket
  const handleBuyCaptainTicket = () => {
    window.location.href = `/checkout?table=${table.slug}&type=table`
  }

  // Format event date
  const eventDate = new Date(table.event.event_date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="min-h-screen bg-gray-50" style={getTableThemeVars(table.type)}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{table.name}</h1>
                <p className="text-sm text-gray-500">{table.event.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {userRole && (
                <Badge variant="secondary" className="capitalize">
                  {userRole.toLowerCase().replace("_", " ")}
                </Badge>
              )}
              {table.type === "PREPAID" && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Prepaid
                </Badge>
              )}
              {table.type === "CAPTAIN_PAYG" && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Pay-as-you-go
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Host Message Card */}
        {table.welcome_message && (
          <div className="mb-6">
            <HostMessageCard
              welcomeMessage={table.welcome_message}
              hostName={table.primary_owner.full_name}
            />
          </div>
        )}

        {/* Captain Nudge Card */}
        {showCaptainNudge && (
          <div className="mb-6">
            <CaptainNudgeCard onBuyTicket={handleBuyCaptainTicket} />
          </div>
        )}

        {/* Event Info */}
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{eventDate}</span>
            </div>
            {table.event.venue_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{table.event.venue_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4" />
              <span>Hosted by {table.primary_owner.full_name}</span>
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Seats Filled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.filled_seats}/{stats.capacity}
                </p>
              </div>
            </div>
          </Card>

          <TableStatusCard
            filledSeats={stats.total_purchased}
            capacity={stats.capacity}
            fillPercentage={stats.fill_percentage}
            hostName={table.primary_owner.full_name}
          />

          <Card className="p-6">
            <div>
              <p className="text-sm text-gray-500">Available Seats</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {stats.empty_seats === 0 && stats.placeholder_seats === 0 ? (
                  <span className="text-green-600">Table Full!</span>
                ) : stats.placeholder_seats > 0 ? (
                  <span className="text-amber-600">{stats.placeholder_seats} awaiting details</span>
                ) : (
                  <span>{stats.empty_seats} seats open</span>
                )}
              </p>
            </div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Guest List - 2 columns */}
          <div className="lg:col-span-2">
            <GuestListCard
              tableId={table.id}
              tableSlug={table.slug}
              tableType={table.type}
              capacity={stats.capacity}
              guests={guests}
              placeholderSeats={stats.placeholder_seats}
              canEdit={canEdit}
              currentUserId={currentUser?.id}
            />
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            <InviteLinkCard
              tableSlug={table.slug}
              tableName={table.name}
            />

            <TotalImpactCard
              totalRaisedCents={totalRaisedCents}
              organizationName={organizationName}
            />

            {canEdit && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/dashboard/table/${table.slug}/edit`}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Table Details
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Share2 className="w-4 h-4 mr-2" />
                    Send Email Invitations
                  </Button>
                  <CelebrateButton />
                </div>
              </Card>
            )}

            {/* Table Reference */}
            {table.reference_code && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Table Reference</h3>
                <p className="font-mono text-lg text-gray-700">{table.reference_code}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Use this code for event check-in
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
