// Component: TotalImpactCard
// Shows total amount raised for the organization

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Heart } from "lucide-react"

interface TotalImpactCardProps {
  totalRaisedCents: number
  organizationName: string
}

export function TotalImpactCard({
  totalRaisedCents,
  organizationName,
}: TotalImpactCardProps) {
  const totalRaised = totalRaisedCents / 100

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <CardTitle className="text-sm font-medium uppercase opacity-90">
            Total Impact
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-4xl font-bold mb-2">
          ${totalRaised.toLocaleString()}
        </p>
        <p className="text-sm opacity-75">
          Raised for {organizationName}
        </p>
        <Heart className="h-16 w-16 opacity-20 absolute bottom-4 right-4" />
      </CardContent>
    </Card>
  )
}
