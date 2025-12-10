import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { CheckoutSteps } from "@/components/public/checkout"
import { ArrowLeft } from "lucide-react"

interface CheckoutPageProps {
  searchParams: Promise<{
    event?: string
    tier?: string
    type?: string
    mode?: string
  }>
}

// Fallback prices per tier (in cents)
const FALLBACK_PRICES: Record<string, number> = {
  STANDARD: 25000,
  VIP: 50000,
  VVIP: 75000,
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams

  const eventSlug = params.event || "pink-gala-50th"
  const tier = (params.tier?.toUpperCase() || "VIP") as "STANDARD" | "VIP" | "VVIP"
  const type = params.type || "individual"
  const mode = params.mode as "host" | "captain" | undefined

  // Fetch event and product from database
  let eventId = ""
  let productId = ""
  let productKind: "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT" = "INDIVIDUAL_TICKET"
  let pricePerTicket = FALLBACK_PRICES[tier]
  let eventName = "Pink Gala 50th Anniversary"
  let eventDate = "February 22, 2025"

  try {
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ slug: eventSlug }, { is_active: true }],
      },
      include: {
        products: {
          where: {
            is_active: true,
            tier: tier,
            kind: type === "table" ? "FULL_TABLE" : "INDIVIDUAL_TICKET",
          },
          take: 1,
        },
      },
    })

    if (event) {
      eventId = event.id
      eventName = event.name
      eventDate = event.event_date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      if (event.products[0]) {
        productId = event.products[0].id
        productKind = event.products[0].kind as "INDIVIDUAL_TICKET" | "FULL_TABLE" | "CAPTAIN_COMMITMENT"
        pricePerTicket = event.products[0].price_cents
      }
    }
  } catch (error) {
    console.log("Using fallback checkout data:", error)
  }

  // If no event/product found, show error
  if (!eventId || !productId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to tickets
            </Link>
          </div>
        </header>

        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Ticket Not Available
          </h1>
          <p className="text-gray-600 mb-8">
            The selected ticket type is not available. Please go back and select
            a different option.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-brand-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-accent transition-colors"
          >
            View Available Tickets
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to tickets
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            Secure Checkout
          </h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <CheckoutSteps
          eventId={eventId}
          productId={productId}
          productKind={productKind}
          ticketType={tier}
          format={type as "individual" | "table"}
          mode={mode}
          pricePerTicket={pricePerTicket}
          eventName={eventName}
          eventDate={eventDate}
        />
      </main>
    </div>
  )
}
