// src/app/api/orders/route.ts
// =============================================================================
// Orders API - List and Create Orders (Admin Invitations)
// =============================================================================
// Phase 5 Update: Added organization_id, tier, reference_code on guest creation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from "crypto";
import { 
  generateGuestReferenceCode,
  getProductTier,
} from "@/lib/reference-codes";
import { 
  OrderFiltersSchema, 
  CreateAdminOrderSchema 
} from "@/lib/validation/orders";

// =============================================================================
// GET /api/orders - List Orders
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = OrderFiltersSchema.parse({
      event_id: searchParams.get("event_id") || undefined,
      user_id: searchParams.get("user_id") || undefined,
      table_id: searchParams.get("table_id") || undefined,
      status: searchParams.get("status") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
    });

    // Build where clause
    const where: any = {};

    if (filters.event_id) where.event_id = filters.event_id;
    if (filters.user_id) where.user_id = filters.user_id;
    if (filters.table_id) where.table_id = filters.table_id;
    if (filters.status) where.status = filters.status;

    // Non-admins can only see their own orders
    if (!user.isAdmin) {
      where.user_id = user.id;
    }

    const total = await prisma.order.count({ where });

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            kind: true,
            tier: true,
            price_cents: true,
          },
        },
        table: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            guest_assignments: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    });

    return NextResponse.json({
      orders,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    });
  } catch (error) {
    console.error("List orders error:", error);
    return NextResponse.json({ error: "Failed to list orders" }, { status: 500 });
  }
}

// =============================================================================
// POST /api/orders - Create Admin Order (Invitation)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can create orders directly
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const data = CreateAdminOrderSchema.parse(body);

    // Verify product exists and get event info
    const product = await prisma.product.findUnique({
      where: { id: data.product_id },
      include: {
        event: {
          select: {
            id: true,
            organization_id: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (product.event_id !== data.event_id) {
      return NextResponse.json(
        { error: "Product does not belong to this event" },
        { status: 400 }
      );
    }

    // Verify table if specified
    if (data.table_id) {
      const table = await prisma.table.findUnique({
        where: { id: data.table_id },
      });

      if (!table || table.event_id !== data.event_id) {
        return NextResponse.json({ error: "Invalid table" }, { status: 400 });
      }
    }

    // Find or create invited user
    let invitedUser = await prisma.user.findUnique({
      where: { email: data.invited_email.toLowerCase() },
    });

    if (!invitedUser) {
      invitedUser = await prisma.user.create({
        data: {
          email: data.invited_email.toLowerCase(),
        },
      });
    }

    // Calculate price
    const priceCents = data.custom_price_cents ?? product.price_cents;
    const totalCents = priceCents * data.quantity;

    // Generate payment link token
    const paymentLinkToken = randomBytes(32).toString("hex");

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expires_in_days);

    // Determine status based on price
    const status = totalCents === 0 ? "COMPLETED" : "AWAITING_PAYMENT";

    // Create the order
    const order = await prisma.order.create({
      data: {
        event_id: data.event_id,
        user_id: invitedUser.id,
        product_id: data.product_id,
        table_id: data.table_id || null,
        quantity: data.quantity,
        amount_cents: totalCents,
        discount_cents: 0,
        status,
        is_admin_created: true,
        invited_email: data.invited_email.toLowerCase(),
        custom_price_cents: data.custom_price_cents,
        payment_link_token: totalCents > 0 ? paymentLinkToken : null,
        payment_link_expires: totalCents > 0 ? expiresAt : null,
        notes: data.notes,
      },
    });

    // If $0 (comp ticket), create guest assignment immediately
    if (totalCents === 0) {
      // Phase 5: Get organization_id and generate reference_code
      const organizationId = product.event.organization_id;
      const referenceCode = await generateGuestReferenceCode(organizationId);
      const tier = product.tier;

      await prisma.guestAssignment.create({
        data: {
          event_id: data.event_id,
          organization_id: organizationId,  // Phase 5
          table_id: data.table_id || null,
          user_id: invitedUser.id,
          order_id: order.id,
          tier: tier,  // Phase 5
          reference_code: referenceCode,  // Phase 5
        },
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        organization_id: product.event.organization_id,
        event_id: data.event_id,
        actor_id: user.id,
        action: "ORDER_INVITED",
        entity_type: "ORDER",
        entity_id: order.id,
        metadata: {
          invited_email: data.invited_email,
          custom_price_cents: data.custom_price_cents,
          quantity: data.quantity,
          is_comp: totalCents === 0,
          expires_at: expiresAt.toISOString(),
        },
      },
    });

    // Build payment link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const paymentLink = totalCents > 0 
      ? `${baseUrl}/pay/${paymentLinkToken}`
      : null;

    return NextResponse.json({
      order,
      payment_link: paymentLink,
      is_comp: totalCents === 0,
    }, { status: 201 });
  } catch (error) {
    console.error("Create order error:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}