import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Find the waitlist entry
    const entry = await prisma.waitlistEntry.findUnique({
      where: { id },
      include: {
        event: true,
        user: true,
      },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Waitlist entry not found" },
        { status: 404 }
      );
    }

    if (entry.status !== "WAITING") {
      return NextResponse.json(
        { error: "Only waiting entries can be converted" },
        { status: 400 }
      );
    }

    // Get the email for the invitation
    const email = entry.email || entry.user?.email;
    if (!email) {
      return NextResponse.json(
        { error: "No email associated with this entry" },
        { status: 400 }
      );
    }

    // Get an individual ticket product for this event
    const product = await prisma.product.findFirst({
      where: {
        event_id: entry.event_id,
        kind: "INDIVIDUAL_TICKET",
        is_active: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "No individual ticket product found for this event" },
        { status: 400 }
      );
    }

    // Find or create a user for this email
    let targetUser = entry.user;
    if (!targetUser) {
      targetUser = await prisma.user.findUnique({
        where: { email },
      });
      if (!targetUser) {
        targetUser = await prisma.user.create({
          data: {
            email,
            auth_provider: "email",
          },
        });
      }
    }

    // Create an admin order (invitation) for the waitlist entry
    const { randomBytes } = await import("crypto");
    const { addDays } = await import("date-fns");

    const paymentLinkToken = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), 7);

    const order = await prisma.order.create({
      data: {
        event_id: entry.event_id,
        user_id: targetUser.id,
        product_id: product.id,
        quantity: entry.quantity,
        amount_cents: product.price_cents * entry.quantity,
        custom_price_cents: product.price_cents * entry.quantity,
        status: "AWAITING_PAYMENT",
        is_admin_created: true,
        invited_email: email,
        payment_link_token: paymentLinkToken,
        payment_link_expires: expiresAt,
        notes: `Converted from waitlist entry: ${entry.id}`,
      },
    });

    // Update the waitlist entry status
    await prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: "CONVERTED",
        converted_order_id: order.id,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        organization_id: entry.event.organization_id,
        event_id: entry.event_id,
        actor_id: user.id,
        action: "WAITLIST_CONVERTED",
        entity_type: "WAITLIST_ENTRY",
        entity_id: entry.id,
        metadata: {
          email,
          quantity: entry.quantity,
          orderId: order.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("Failed to convert waitlist entry:", error);
    return NextResponse.json(
      { error: "Failed to convert waitlist entry" },
      { status: 500 }
    );
  }
}
