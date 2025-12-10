// =============================================================================
// Claim Seat API Route
// =============================================================================
// POST /api/tables/[slug]/claim-seat - Claim an empty seat on a PREPAID table
// =============================================================================

export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth"
import { z } from "zod"
import { generateGuestReferenceCode } from "@/lib/reference-codes"

// =============================================================================
// Request Schema
// =============================================================================

const ClaimSeatSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  dietary_restrictions: z.string().max(500).nullable().optional(),
})

// =============================================================================
// POST /api/tables/[slug]/claim-seat
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // 1. Get current user (optional - guests can claim without account)
    const currentUser = await getCurrentUser()

    // 2. Find table
    const table = await prisma.table.findFirst({
      where: { slug },
      include: {
        event: {
          select: { id: true, organization_id: true },
        },
        orders: {
          where: { status: "COMPLETED" },
          select: { id: true, quantity: true },
        },
        guest_assignments: {
          select: { id: true },
        },
      },
    })

    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    // 3. Verify table is PREPAID (only PREPAID tables can have free seat claims)
    if (table.type !== "PREPAID") {
      return NextResponse.json(
        { error: "Seats on this table must be purchased" },
        { status: 400 }
      )
    }

    // 4. Check if there are available placeholder seats
    const totalPurchased = table.orders.reduce((sum, o) => sum + o.quantity, 0)
    const assignedSeats = table.guest_assignments.length
    const availablePlaceholders = totalPurchased - assignedSeats

    if (availablePlaceholders <= 0) {
      return NextResponse.json(
        { error: "No available seats to claim" },
        { status: 400 }
      )
    }

    // 5. Parse and validate request body
    const body = await req.json()
    const parseResult = ClaimSeatSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data

    // 6. Find or create user for the guest
    let guestUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (!guestUser) {
      guestUser = await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          first_name: data.first_name,
          last_name: data.last_name,
        },
      })
    }

    // 7. Check if user already has a seat at this table
    const existingAssignment = await prisma.guestAssignment.findFirst({
      where: {
        table_id: table.id,
        user_id: guestUser.id,
      },
    })

    if (existingAssignment) {
      return NextResponse.json(
        { error: "This guest already has a seat at this table" },
        { status: 400 }
      )
    }

    // 8. Find an order to link to (use the first one with available capacity)
    const orderForAssignment = table.orders[0]
    if (!orderForAssignment) {
      return NextResponse.json(
        { error: "No valid order found for seat assignment" },
        { status: 400 }
      )
    }

    // 9. Generate reference code
    const referenceCode = await generateGuestReferenceCode(table.event.organization_id)

    // 10. Create guest assignment
    const guestAssignment = await prisma.guestAssignment.create({
      data: {
        event_id: table.event.id,
        organization_id: table.event.organization_id,
        table_id: table.id,
        user_id: guestUser.id,
        order_id: orderForAssignment.id,
        dietary_restrictions: data.dietary_restrictions as Prisma.InputJsonValue,
        reference_code: referenceCode,
        tier: "VIP", // Default tier for claimed seats
      },
    })

    // 11. Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: table.event.organization_id,
        event_id: table.event.id,
        actor_id: currentUser?.id || guestUser.id,
        action: "GUEST_ADDED",
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: guestAssignment.id,
        metadata: {
          table_id: table.id,
          table_name: table.name,
          guest_email: guestUser.email,
          guest_name: `${data.first_name} ${data.last_name}`,
          reference_code: referenceCode,
          claimed_by: currentUser ? "owner" : "self",
        },
      },
    })

    return NextResponse.json({
      success: true,
      guest_assignment: {
        id: guestAssignment.id,
        reference_code: referenceCode,
        user: {
          id: guestUser.id,
          email: guestUser.email,
          first_name: guestUser.first_name,
          last_name: guestUser.last_name,
        },
      },
    })

  } catch (error) {
    console.error("Error claiming seat:", error)
    return NextResponse.json(
      { error: "Failed to claim seat" },
      { status: 500 }
    )
  }
}
