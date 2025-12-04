// =============================================================================
// Payment Link Page
// =============================================================================
// /pay/[token] - Payment page for admin-created ticket invitations
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// =============================================================================
// Types
// =============================================================================

interface OrderDetails {
  id: string;
  quantity: number;
  amount_cents: number;
  amount_display: string;
  status: string;
  expires_at: string | null;
  product: {
    name: string;
    kind: string;
    tier: string;
  };
  event: {
    name: string;
    date: string | null;
  };
  table: {
    name: string;
  } | null;
  recipient: {
    email: string;
    name: string | null;
  };
}

interface PaymentState {
  loading: boolean;
  error: string | null;
  order: OrderDetails | null;
  clientSecret: string | null;
  paymentSuccess: boolean;
}

// =============================================================================
// Payment Page Component
// =============================================================================

export default function PaymentLinkPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<PaymentState>({
    loading: true,
    error: null,
    order: null,
    clientSecret: null,
    paymentSuccess: false,
  });

  // Fetch order details on mount
  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/pay/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: data.error || "Failed to load payment details",
          }));
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          order: data.order,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load payment details",
        }));
      }
    }

    if (token) {
      fetchOrder();
    }
  }, [token]);

  // Initialize payment
  async function handleInitPayment() {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/pay/${token}`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.error || "Failed to initialize payment",
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        clientSecret: data.client_secret,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to initialize payment",
      }));
    }
  }

  // =============================================================================
  // Render States
  // =============================================================================

  // Loading state
  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Unavailable</h1>
            <p className="text-gray-600">{state.error}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (state.paymentSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600">
              Your ticket has been confirmed. You&apos;ll receive a confirmation email shortly.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
            >
              View My Tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  const order = state.order!;

  // Payment form with client secret
  if (state.clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-pink-600 px-6 py-4">
              <h1 className="text-xl font-semibold text-white">{order.event.name}</h1>
              <p className="text-pink-100 text-sm">Complete your ticket purchase</p>
            </div>

            {/* Order Summary */}
            <div className="px-6 py-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{order.product.name}</p>
                  <p className="text-sm text-gray-500">Quantity: {order.quantity}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{order.amount_display}</p>
              </div>
            </div>

            {/* Stripe Elements placeholder */}
            <div className="px-6 py-6">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 text-center">
                  💳 Stripe Payment Form would render here
                </p>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Client Secret: {state.clientSecret.substring(0, 20)}...
                </p>
              </div>

              {/* For demo purposes, show a complete button */}
              <p className="text-xs text-gray-500 mb-4 text-center">
                In production, integrate @stripe/react-stripe-js PaymentElement here.
              </p>

              <button
                onClick={() => setState((prev) => ({ ...prev, paymentSuccess: true }))}
                className="w-full py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition"
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Order details - ready to pay
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-pink-600 px-6 py-4">
            <h1 className="text-xl font-semibold text-white">{order.event.name}</h1>
            <p className="text-pink-100 text-sm">You&apos;ve been invited!</p>
          </div>

          {/* Invitation Details */}
          <div className="px-6 py-6">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                {order.recipient.name ? (
                  <>Hello <span className="font-medium">{order.recipient.name}</span>,</>
                ) : (
                  <>Hello,</>
                )}
              </p>
              <p className="text-gray-600 mt-1">
                You have a reserved ticket for the {order.event.name}.
              </p>
            </div>

            {/* Ticket Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Ticket</span>
                <span className="font-medium text-gray-900">{order.product.name}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Quantity</span>
                <span className="font-medium text-gray-900">{order.quantity}</span>
              </div>
              {order.table && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Table</span>
                  <span className="font-medium text-gray-900">{order.table.name}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Total</span>
                  <span className="text-xl font-bold text-gray-900">{order.amount_display}</span>
                </div>
              </div>
            </div>

            {/* Expiration Notice */}
            {order.expires_at && (
              <p className="text-sm text-amber-600 text-center mb-4">
                ⏰ This invitation expires on {new Date(order.expires_at).toLocaleDateString()}
              </p>
            )}

            {/* Pay Button */}
            <button
              onClick={handleInitPayment}
              disabled={state.loading}
              className="w-full py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.loading ? "Loading..." : `Pay ${order.amount_display}`}
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Secure payment powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
