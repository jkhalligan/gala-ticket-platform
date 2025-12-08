// src/app/api/admin/transactions/route.ts
// GET: Fetch Stripe payment intents with filtering and pagination

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.is_super_admin || await prisma.organizationAdmin.findFirst({
      where: { user_id: user.id },
    });

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '100');
    const startingAfter = searchParams.get('starting_after') || undefined;

    // Build Stripe query parameters
    const params: any = {
      limit: Math.min(limit, 100), // Max 100 per Stripe API
    };

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      params.created = {};
      if (dateFrom) {
        params.created.gte = Math.floor(new Date(dateFrom).getTime() / 1000);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        params.created.lt = Math.floor(endDate.getTime() / 1000);
      }
    }

    // Fetch payment intents from Stripe with expanded charges
    const paymentIntents = await stripe.paymentIntents.list({
      ...params,
      expand: ['data.latest_charge'],
    });

    // Map orders to payment intents for linking
    const orderMap = new Map<string, any>();
    if (paymentIntents.data.length > 0) {
      const piIds = paymentIntents.data.map(pi => pi.id);
      const orders = await prisma.order.findMany({
        where: {
          stripe_payment_intent_id: { in: piIds },
        },
        select: {
          id: true,
          stripe_payment_intent_id: true,
          invited_email: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      orders.forEach(order => {
        if (order.stripe_payment_intent_id) {
          orderMap.set(order.stripe_payment_intent_id, order);
        }
      });
    }

    // Filter and transform results
    let transactions = paymentIntents.data.map(pi => {
      const order = orderMap.get(pi.id);
      // Get payment method from latest charge
      const latestCharge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      const paymentMethod = latestCharge?.payment_method_details;
      const customerEmail = pi.receipt_email || order?.invited_email || order?.user?.email || null;

      return {
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        payment_method: paymentMethod ? {
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
          } : null,
        } : null,
        customer_email: customerEmail,
        created: pi.created,
        order_id: order?.id || null,
        metadata: pi.metadata,
      };
    });

    // Apply client-side filters (status and email)
    if (status && status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }

    if (email) {
      const emailLower = email.toLowerCase();
      transactions = transactions.filter(t =>
        t.customer_email?.toLowerCase().includes(emailLower)
      );
    }

    return NextResponse.json({
      transactions,
      has_more: paymentIntents.has_more,
      next_starting_after: paymentIntents.data[paymentIntents.data.length - 1]?.id,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
