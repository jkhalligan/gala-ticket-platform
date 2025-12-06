import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";

// GET - List all admin-created invitations
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      where: {
        is_admin_created: true,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const invitations = orders.map((order) => ({
      id: order.id,
      email: order.invited_email || "",
      amountCents: order.custom_price_cents || order.amount_cents,
      status: order.status,
      paymentLinkToken: order.payment_link_token || "",
      expiresAt: order.payment_link_expires?.toISOString() || null,
      createdAt: order.created_at.toISOString(),
      productName: order.product.name,
    }));

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Failed to fetch invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}

// POST - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, amountCents, expirationDays = 7 } = body;

    if (!email || !amountCents) {
      return NextResponse.json(
        { error: "Email and amount are required" },
        { status: 400 }
      );
    }

    // Get the first active event (or you could pass event_id in the request)
    const event = await prisma.event.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { created_at: "desc" },
    });

    if (!event) {
      return NextResponse.json(
        { error: "No active event found" },
        { status: 400 }
      );
    }

    // Get the first individual ticket product for this event
    const product = await prisma.product.findFirst({
      where: {
        event_id: event.id,
        kind: "INDIVIDUAL_TICKET",
        is_active: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "No individual ticket product found for the event" },
        { status: 400 }
      );
    }

    // Generate a unique payment link token
    const paymentLinkToken = randomBytes(32).toString("hex");

    // Calculate expiration date
    const expiresAt = addDays(new Date(), expirationDays);

    // Find or create a placeholder user for this invitation
    let invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      // Create a placeholder user
      invitedUser = await prisma.user.create({
        data: {
          email,
          auth_provider: "email",
        },
      });
    }

    // Create the admin-created order (invitation)
    const order = await prisma.order.create({
      data: {
        event_id: event.id,
        user_id: invitedUser.id,
        product_id: product.id,
        amount_cents: amountCents,
        custom_price_cents: amountCents,
        status: "AWAITING_PAYMENT",
        is_admin_created: true,
        invited_email: email,
        payment_link_token: paymentLinkToken,
        payment_link_expires: expiresAt,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    // TODO: Send email with payment link to the invited user

    return NextResponse.json({
      invitation: {
        id: order.id,
        email: order.invited_email,
        amountCents: order.custom_price_cents || order.amount_cents,
        status: order.status,
        paymentLinkToken: order.payment_link_token,
        expiresAt: order.payment_link_expires?.toISOString(),
        createdAt: order.created_at.toISOString(),
        productName: order.product.name,
      },
    });
  } catch (error) {
    console.error("Failed to create invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}
