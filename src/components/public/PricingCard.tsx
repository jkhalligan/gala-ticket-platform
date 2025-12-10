import { Check } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface PricingCardProps {
  title: string
  price: string | number
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  badge?: string
}

export function PricingCard({
  title,
  price,
  description,
  features,
  cta,
  href,
  highlighted = false,
  badge,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative bg-white rounded-lg p-6 transition-all",
        "border-2 hover:shadow-lg",
        highlighted
          ? "border-brand-primary"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      {badge && (
        <span className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold uppercase">
          {badge}
        </span>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-3xl font-bold text-gray-900 mb-1">
          {typeof price === "number"
            ? `$${price.toLocaleString()}`
            : price}
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      <ul className="space-y-3 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check
              className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={cn(
          "block w-full py-3 rounded-lg text-center font-semibold transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2",
          highlighted
            ? "bg-brand-primary text-white hover:bg-brand-accent"
            : "border-2 border-brand-primary text-brand-primary hover:bg-brand-secondary"
        )}
      >
        {cta}
      </Link>
    </div>
  )
}
