// src/app/api/guests/route.ts
// =============================================================================
// Guests API - List and Create Guest Assignments
// =============================================================================
// Phase 5 Update: Added organization_id, tier, reference_code on guest creation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GuestFiltersSchema, CreateGuestSchema } from "@/lib/validation/guests";
import {
  generateGuestReferenceCode,
  getOrganizationIdFromEvent,
} from "@/lib/reference-codes";

// =============================================================================
// GET /api/guests - List Guest Assignments
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = GuestFiltersSchema.parse({
      event_id: searchParams.get("event_id") || undefined,
      table_id: searchParams.get("table_id") || undefined,
      user_id: searchParams.get("user_id") || undefined,
      order_id: searchParams.get("order_id") || undefined,
      checked_in: searchParams.get("checked_in") === "true" ? true : 
                  searchParams.get("checked_in") === "false" ? false : undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    });

    // Build where clause
    const where: any = {};

    if (filters.event_id) where.event_id = filters.event_id;
    if (filters.table_id) where.table_id = filters.table_id;
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.order_id) where.order_id = filters.order_id;
    if (filters.checked_in !== undefined) {
      where.checked_in_at = filters.checked_in ? { not: null } : null;
    }

    // Non-admins can only see their own guest assignments or tables they manage
    if (!user.isAdmin) {
      where.OR = [
        { user_id: user.id },
        { table: { primary_owner_id: user.id } },
        { table: { user_roles: { some: { user_id: user.id } } } },
      ];
    }

    const total = await prisma.guestAssignment.count({ where });

    const guests = await prisma.guestAssignment.findMany({
      where,
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
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
            reference_code: true,
          },
        },
        order: {
          select: {
            id: true,
            quantity: true,
            status: true,
            product: {
              select: {
                name: true,
                tier: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return NextResponse.json({
      guests,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error("List guests error:", error);
    return NextResponse.json({ error: "Failed to list guests" }, { status: 500 });
  }
}

// =============================================================================
// POST /api/guests - Create Guest Assignment
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = CreateGuestSchema.parse(body);

    // Verify order exists and is completed
    const order = await prisma.order.findUnique({
      where: { id: data.order_id },
      include: {
        product: {
          select: { tier: true },
        },
        event: {
          select: { organization_id: true },
        },
        _count: {
          select: { guest_assignments: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot assign guest to incomplete order" },
        { status: 400 }
      );
    }

    // Check if order has available seats (placeholder seats)
    const assignedSeats = order._count.guest_assignments;
    if (assignedSeats >= order.quantity) {
      return NextResponse.json(
        { error: "No available seats on this order" },
        { status: 400 }
      );
    }

    // Get or create user for guest
    let guestUserId = data.user_id;

    if (!guestUserId && data.email) {
      // Find or create user by email
      let guestUser = await prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: {
            email: data.email.toLowerCase(),
            first_name: data.first_name,
            last_name: data.last_name,
          },
        });
      }

      guestUserId = guestUser.id;
    }

    if (!guestUserId) {
      return NextResponse.json(
        { error: "Either user_id or email must be provided" },
        { status: 400 }
      );
    }

    // Check if user already has an assignment at this table
    if (data.table_id) {
      const existingAssignment = await prisma.guestAssignment.findFirst({
        where: {
          user_id: guestUserId,
          table_id: data.table_id,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          { error: "User is already assigned to this table" },
          { status: 409 }
        );
      }
    }

    // Phase 5: Get organization_id and generate reference_code
    const organizationId = order.event.organization_id;
    const referenceCode = await generateGuestReferenceCode(organizationId);
    const tier = order.product.tier;

    // Create guest assignment
    const guestAssignment = await prisma.guestAssignment.create({
      data: {
        event_id: data.event_id,
        organization_id: organizationId,  // Phase 5
        table_id: data.table_id,
        user_id: guestUserId,
        order_id: data.order_id,
        display_name: data.display_name,
        dietary_restrictions: data.dietary_restrictions,
        tier: tier,  // Phase 5
        reference_code: referenceCode,  // Phase 5
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
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
            quantity: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: organizationId,
        event_id: data.event_id,
        actor_id: user.id,
        action: "GUEST_ADDED",
        entity_type: "GUEST_ASSIGNMENT",
        entity_id: guestAssignment.id,
        metadata: {
          guest_user_id: guestUserId,
          table_id: data.table_id,
          order_id: data.order_id,
          reference_code: referenceCode,
          tier: tier,
        },
      },
    });

    return NextResponse.json({ guest: guestAssignment }, { status: 201 });
  } catch (error) {
    console.error("Create guest error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create guest" }, { status: 500 });
  }
}