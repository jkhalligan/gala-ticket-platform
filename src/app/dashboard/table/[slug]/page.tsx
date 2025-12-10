// =============================================================================
// Table Dashboard Page
// =============================================================================
// /dashboard/table/[slug] - View and manage a specific table
// =============================================================================

import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTablePermissions } from "@/lib/permissions"
import { TableDashboard } from "@/components/dashboard/TableDashboard"

export const dynamic = "force-dynamic"

interface TableDashboardPageProps {
  params: Promise<{ slug: string }>
}

export default async function TableDashboardPage({
  params,
}: TableDashboardPageProps) {
  const { slug } = await params

  // Get current user (public dashboard, may be null)
  const currentUser = await getCurrentUser()

  // Fetch table with all related data
  const table = await prisma.table.findFirst({
    where: { slug },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          event_date: true,
          venue_name: true,
          organization_id: true,
        },
      },
      primary_owner: {
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
        },
      },
      user_roles: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      },
      guest_assignments: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              phone: true,
            },
          },
          order: {
            select: {
              id: true,
              user_id: true,
              amount_cents: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
      orders: {
        where: { status: "COMPLETED" },
        select: {
          id: true,
          user_id: true,
          quantity: true,
          amount_cents: true,
        },
      },
    },
  })

  if (!table) {
    notFound()
  }

  // Determine user permissions
  let userRole: string | null = null
  let canEdit = false
  let isOwner = false
  let isGuest = false

  if (currentUser) {
    // Check if owner
    isOwner = currentUser.id === table.primary_owner_id

    // Check for explicit role
    const tableRole = table.user_roles.find((r) => r.user_id === currentUser.id)
    userRole = isOwner ? "OWNER" : tableRole?.role || null

    // Check if guest at this table
    isGuest = table.guest_assignments.some((g) => g.user_id === currentUser.id)

    // Admin or owner can edit
    canEdit = isOwner || currentUser.isAdmin || ["CO_OWNER", "MANAGER"].includes(userRole || "")
  }

  // Format data for client component
  const formattedTable = {
    id: table.id,
    name: table.name,
    slug: table.slug,
    type: table.type as "PREPAID" | "CAPTAIN_PAYG",
    status: table.status,
    capacity: table.capacity,
    welcome_message: table.welcome_message,
    reference_code: table.reference_code,
    event: {
      id: table.event.id,
      name: table.event.name,
      event_date: table.event.event_date.toISOString(),
      venue_name: table.event.venue_name,
    },
    primary_owner: {
      id: table.primary_owner.id,
      email: table.primary_owner.email,
      first_name: table.primary_owner.first_name,
      last_name: table.primary_owner.last_name,
      full_name: [table.primary_owner.first_name, table.primary_owner.last_name]
        .filter(Boolean)
        .join(" ") || table.primary_owner.email,
    },
  }

  // Calculate stats
  const totalPurchased = table.orders.reduce((sum, o) => sum + o.quantity, 0)
  const filledSeats = table.guest_assignments.length
  const placeholderSeats = Math.max(0, totalPurchased - filledSeats)
  const emptySeats = table.capacity - totalPurchased

  const stats = {
    capacity: table.capacity,
    total_purchased: totalPurchased,
    filled_seats: filledSeats,
    placeholder_seats: placeholderSeats,
    empty_seats: emptySeats,
    fill_percentage: table.capacity > 0 ? Math.round((totalPurchased / table.capacity) * 100) : 0,
  }

  // Format guests
  const guests = table.guest_assignments.map((ga) => ({
    id: ga.id,
    user_id: ga.user_id,
    display_name: ga.display_name,
    dietary_restrictions: ga.dietary_restrictions as string | null,
    checked_in_at: ga.checked_in_at?.toISOString() || null,
    reference_code: ga.reference_code,
    user: {
      id: ga.user.id,
      email: ga.user.email,
      first_name: ga.user.first_name,
      last_name: ga.user.last_name,
      phone: ga.user.phone,
      full_name: [ga.user.first_name, ga.user.last_name].filter(Boolean).join(" ") || ga.user.email,
    },
    is_self_pay: ga.order?.user_id === ga.user_id,
    can_edit: canEdit || (currentUser?.id === ga.user_id), // Guest can edit own details
    can_remove: canEdit && (table.type === "PREPAID" || ga.order?.user_id !== ga.user_id),
  }))

  return (
    <TableDashboard
      table={formattedTable}
      stats={stats}
      guests={guests}
      currentUser={currentUser ? {
        id: currentUser.id,
        email: currentUser.email,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        isAdmin: currentUser.isAdmin,
      } : null}
      userRole={userRole}
      isOwner={isOwner}
      isGuest={isGuest}
      canEdit={canEdit}
    />
  )
}
