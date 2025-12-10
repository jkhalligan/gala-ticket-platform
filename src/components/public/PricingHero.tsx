interface PricingHeroProps {
  title?: string
  highlightedText?: string
  description?: string
}

export function PricingHero({
  title = "Celebrating 50 Years:",
  highlightedText = "The Pink Gala",
  description = "Join us for an evening of celebration, impact, and joy. Choose your experience below.",
}: PricingHeroProps) {
  return (
    <div className="text-center py-16 bg-white">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        {title}{" "}
        <span className="text-brand-primary">{highlightedText}</span>
      </h1>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto px-4">
        {description}
      </p>
    </div>
  )
}
