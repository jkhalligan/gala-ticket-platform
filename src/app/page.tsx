import { prisma } from "@/lib/prisma"
import { PricingHero } from "@/components/public/PricingHero"
import { PricingCardGrid } from "@/components/public/PricingCardGrid"
import type { Tier } from "@/components/public/TierToggle"

// Sample tier data for development (used when no products exist in DB)
const sampleTiers: Array<{ type: Tier; price: number; perks: string[] }> = [
  {
    type: "STANDARD",
    price: 250,
    perks: [
      "General admission seating",
      "Gourmet dinner & open bar",
      "Live entertainment",
      "Silent auction access",
    ],
  },
  {
    type: "VIP",
    price: 500,
    perks: [
      "Premium seating near stage",
      "Gourmet dinner & premium bar",
      "Live entertainment",
      "Silent & live auction access",
      "VIP lounge access",
      "Commemorative gift bag",
    ],
  },
  {
    type: "VVIP",
    price: 1000,
    perks: [
      "Front row seating",
      "Gourmet dinner & top-shelf bar",
      "Live entertainment",
      "All auction access",
      "Exclusive pre-party reception",
      "Meet & greet with performers",
      "Premium gift bag with exclusive items",
      "Valet parking",
    ],
  },
]

export default async function LandingPage() {
  // Try to fetch event and products from database
  let tiers = sampleTiers
  let eventSlug = "pink-gala-50th"

  try {
    const event = await prisma.event.findFirst({
      where: { is_active: true },
      include: {
        products: {
          where: {
            is_active: true,
            kind: "INDIVIDUAL_TICKET",
          },
          orderBy: { price_cents: "asc" },
        },
      },
    })

    if (event && event.products.length > 0) {
      eventSlug = event.slug
      // Convert products to tier format
      tiers = event.products.map((product) => ({
        type: product.tier as Tier,
        price: product.price_cents / 100, // Convert cents to dollars
        perks: product.description
          ? product.description.split("\n").filter(Boolean)
          : [],
      }))
    }
  } catch {
    // Database not available or error - use sample data
    console.log("Using sample tier data for landing page")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PricingHero />
      <PricingCardGrid tiers={tiers} eventSlug={eventSlug} />
    </div>
  )
}
