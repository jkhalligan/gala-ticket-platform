"use client"

import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, MapPin, Ticket } from "lucide-react"
import { TicketCard } from "./TicketCard"

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

interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

interface TicketsDashboardProps {
  user: User
  tickets: TicketData[]
}

export function TicketsDashboard({ user, tickets }: TicketsDashboardProps) {
  // Group tickets by event
  const ticketsByEvent = tickets.reduce(
    (acc, ticket) => {
      const eventId = ticket.event.id
      if (!acc[eventId]) {
        acc[eventId] = {
          event: ticket.event,
          tickets: [],
        }
      }
      acc[eventId].tickets.push(ticket)
      return acc
    },
    {} as Record<string, { event: TicketData["event"]; tickets: TicketData[] }>
  )

  const userName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
              <p className="text-sm text-gray-500">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {Object.values(ticketsByEvent).map((group) => {
          const eventDate = new Date(group.event.event_date).toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )

          return (
            <div key={group.event.id} className="mb-8">
              {/* Event Header */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {group.event.name}
                </h2>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{eventDate}</span>
                  </div>
                  {group.event.venue_name && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{group.event.venue_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ticket Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} userName={userName} />
                ))}
              </div>
            </div>
          )
        })}

        {/* Empty State */}
        {tickets.length === 0 && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Tickets Yet
            </h3>
            <p className="text-gray-500 mb-6">
              You don't have any tickets. Purchase tickets to see them here.
            </p>
            <Button asChild>
              <Link href="/">Browse Events</Link>
            </Button>
          </Card>
        )}
      </main>
    </div>
  )
}
