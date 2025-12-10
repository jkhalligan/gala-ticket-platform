// =============================================================================
// Tickets Dashboard Page
// =============================================================================
// /dashboard/tickets - View all user's tickets
// =============================================================================

import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TicketsDashboard } from "@/components/dashboard/TicketsDashboard"

export const dynamic = "force-dynamic"

export default async function TicketsDashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?redirect=/dashboard/tickets")
  }

  // Fetch all tickets (guest assignments) for this user
  const guestAssignments = await prisma.guestAssignment.findMany({
    where: { user_id: user.id },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          event_date: true,
          venue_name: true,
        },
      },
      table: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      order: {
        select: {
          id: true,
          amount_cents: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  })

  // Format tickets for client component
  const tickets = guestAssignments.map((ga) => ({
    id: ga.id,
    tier: ga.tier as string,
    display_name: ga.display_name,
    dietary_restrictions: ga.dietary_restrictions as string | null,
    checked_in_at: ga.checked_in_at?.toISOString() || null,
    reference_code: ga.reference_code,
    event: {
      id: ga.event.id,
      name: ga.event.name,
      event_date: ga.event.event_date.toISOString(),
      venue_name: ga.event.venue_name,
    },
    table: ga.table
      ? {
          id: ga.table.id,
          name: ga.table.name,
          slug: ga.table.slug,
        }
      : null,
  }))

  return (
    <TicketsDashboard
      user={{
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      }}
      tickets={tickets}
    />
  )
}
