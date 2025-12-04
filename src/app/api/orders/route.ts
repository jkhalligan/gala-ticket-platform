// =============================================================================
// Orders API Route
// =============================================================================
// GET  /api/orders       - List orders (with filters)
// POST /api/orders       - Create admin ticket invitation or comp ticket
// =============================================================================

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  OrderQuerySchema,
  AdminCreateOrderSchema,
  CompTicketSchema,
} from "@/lib/validation/orders";
import { randomBytes } from "crypto";

// =============================================================================
// GET /api/orders
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // 1. Require authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const query = OrderQuerySchema.parse({
      event_id: searchParams.get("event_id") || undefined,
      user_id: searchParams.get("user_id") || undefined,
      table_id: searchParams.get("table_id") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    // 3. Build where clause
    const where: any = {};

    if (query.event_id) {
      where.event_id = query.event_id;
    }

    if (query.table_id) {
      where.table_id = query.table_id;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Non-admins can only see their own orders
    if (!user.isAdmin) {
      where.user_id = user.id;
    } else if (query.user_id) {
      where.user_id = query.user_id;
    }

    // Search by email or name
    if (query.search) {
      where.OR = [
        { user: { email: { contains: query.search, mode: "insensitive" } } },
        { user: { first_name: { contains: query.search, mode: "insensitive" } } },
        { user: { last_name: { contains: query.search, mode: "insensitive" } } },
        { invited_email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // 4. Execute query with pagination
    const skip = (query.page - 1) * query.limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, first_name: true, last_name: true },
          },
          product: {
            select: { id: true, name: true, kind: true, tier: true },
          },
          table: {
            select: { id: true, name: true, slug: true },
          },
          promo_code: {
            select: { id: true, code: true },
          },
          guest_assignments: {
            select: {
              id: true,
              user_id: true,
              display_name: true,
              user: {
                select: { email: true, first_name: true, last_name: true },
              },
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.order.count({ where }),
    ]);

    // 5. Format response
    const formattedOrders = orders.map((order) => ({
      id: order.id,
      event_id: order.event_id,
      user_id: order.user_id,
      product_id: order.product_id,
      table_id: order.table_id,
      quantity: order.quantity,
      amount_cents: order.amount_cents,
      discount_cents: order.discount_cents,
      status: order.status,
      is_admin_created: order.is_admin_created,
      invited_email: order.invited_email,
      payment_link_expires: order.payment_link_expires,
      created_at: order.created_at.toISOString(),
      updated_at: order.updated_at.toISOString(),
      // Related data
      buyer: {
        email: order.user.email,
        name: [order.user.first_name, order.user.last_name].filter(Boolean).join(" ") || null,
      },
      product: order.product,
      table: order.table,
      promo_code: order.promo_code?.code || null,
      guest_count: order.guest_assignments.length,
      guests: order.guest_assignments.map((g) => ({
        id: g.id,
        user_id: g.user_id,
        display_name: g.display_name,
        email: g.user.email,
        name: [g.user.first_name, g.user.last_name].filter(Boolean).join(" ") || null,
      })),
    }));

    return NextResponse.json({
      orders: formattedOrders,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit),
      },
    });

  } catch (error) {
    console.error("Error listing orders:", error);
    return NextResponse.json(
      { error: "Failed to list orders" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/orders
// =============================================================================
// Creates either:
// 1. Admin ticket invitation (AWAITING_PAYMENT with payment link)
// 2. Comp/free ticket (COMPLETED immediately)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Require admin authentication
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 2. Parse request body
    const body = await req.json();
    const orderType = body.order_type || "invitation"; // "invitation" or "comp"

    if (orderType === "comp") {
      return handleCompTicket(body, user.id);
    } else {
      return handleAdminInvitation(body, user.id);
    }

  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create order" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Admin Ticket Invitation
// =============================================================================

async function handleAdminInvitation(body: any, adminUserId: string) {
  // Validate input
  const data = AdminCreateOrderSchema.parse(body);

  // Verify product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: data.product_id },
    include: { event: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (!product.is_active) {
    return NextResponse.json({ error: "Product is not active" }, { status: 400 });
  }

  // Verify table if provided
  if (data.table_id) {
    const table = await prisma.table.findUnique({
      where: { id: data.table_id },
    });
    if (!table || table.event_id !== data.event_id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
  }

  // Get or create user for the invited email
  let invitedUser = await prisma.user.findUnique({
    where: { email: data.invited_email.toLowerCase() },
  });

  if (!invitedUser) {
    invitedUser = await prisma.user.create({
      data: { email: data.invited_email.toLowerCase() },
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

  // If $0, create guest assignment immediately
  if (totalCents === 0) {
    await prisma.guestAssignment.create({
      data: {
        event_id: data.event_id,
        table_id: data.table_id || null,
        user_id: invitedUser.id,
        order_id: order.id,
      },
    });
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      organization_id: product.event.organization_id,
      event_id: data.event_id,
      actor_id: adminUserId,
      action: "ORDER_INVITED",
      entity_type: "ORDER",
      entity_id: order.id,
      metadata: {
        invited_email: data.invited_email,
        custom_price_cents: data.custom_price_cents,
        quantity: data.quantity,
        expires_at: expiresAt.toISOString(),
      },
    },
  });

  // Build payment link URL
  const paymentLink = totalCents > 0 ? `/pay/${paymentLinkToken}` : null;

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      status: order.status,
      amount_cents: order.amount_cents,
      invited_email: order.invited_email,
      payment_link: paymentLink,
      payment_link_expires: order.payment_link_expires?.toISOString() || null,
    },
  }, { status: 201 });
}

// =============================================================================
// Comp Ticket (Free Ticket)
// =============================================================================

async function handleCompTicket(body: any, adminUserId: string) {
  // Validate input
  const data = CompTicketSchema.parse(body);

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: data.product_id },
    include: { event: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Verify table if provided
  if (data.table_id) {
    const table = await prisma.table.findUnique({
      where: { id: data.table_id },
    });
    if (!table || table.event_id !== data.event_id) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }
  }

  // Get or create user
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

  // Create order (always COMPLETED for comp tickets)
  const order = await prisma.order.create({
    data: {
      event_id: data.event_id,
      user_id: guestUser.id,
      product_id: data.product_id,
      table_id: data.table_id || null,
      quantity: data.quantity,
      amount_cents: 0,
      discount_cents: 0,
      status: "COMPLETED",
      is_admin_created: true,
      notes: data.notes,
    },
  });

  // Create guest assignment
  await prisma.guestAssignment.create({
    data: {
      event_id: data.event_id,
      table_id: data.table_id || null,
      user_id: guestUser.id,
      order_id: order.id,
      display_name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      organization_id: product.event.organization_id,
      event_id: data.event_id,
      actor_id: adminUserId,
      action: "ORDER_COMPLETED",
      entity_type: "ORDER",
      entity_id: order.id,
      metadata: {
        order_type: "comp",
        recipient_email: data.email,
        quantity: data.quantity,
      },
    },
  });

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      status: order.status,
      amount_cents: 0,
      recipient_email: data.email,
    },
  }, { status: 201 });
}
