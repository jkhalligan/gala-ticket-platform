import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addDays } from "date-fns";

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

    // Find the invitation (admin-created order)
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (!order.is_admin_created) {
      return NextResponse.json(
        { error: "This is not an invitation" },
        { status: 400 }
      );
    }

    if (order.status !== "AWAITING_PAYMENT") {
      return NextResponse.json(
        { error: "Only pending invitations can be resent" },
        { status: 400 }
      );
    }

    // Extend the expiration date by 7 more days from now
    const newExpiration = addDays(new Date(), 7);

    await prisma.order.update({
      where: { id },
      data: {
        payment_link_expires: newExpiration,
      },
    });

    // TODO: Actually send the email with the payment link
    // For now, we just update the expiration date

    return NextResponse.json({
      success: true,
      newExpiration: newExpiration.toISOString(),
    });
  } catch (error) {
    console.error("Failed to resend invitation:", error);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
