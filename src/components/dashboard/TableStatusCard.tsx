// Component: TableStatusCard
// Enhanced status card with progress bar

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface TableStatusCardProps {
  filledSeats: number
  capacity: number
  fillPercentage: number
  hostName: string
}

export function TableStatusCard({
  filledSeats,
  capacity,
  fillPercentage,
  hostName,
}: TableStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">
          Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {filledSeats}/{capacity} Seats Filled
          </span>
          <span
            className="text-2xl font-bold"
            style={{ color: 'var(--table-accent-color, hsl(var(--primary)))' }}
          >
            {fillPercentage}%
          </span>
        </div>

        <Progress
          value={fillPercentage}
          className="h-2"
        />

        <p className="text-sm text-muted-foreground">
          {fillPercentage < 100
            ? `Help ${hostName} reach 100% by sharing the link!`
            : `🎉 Table is fully funded!`}
        </p>
      </CardContent>
    </Card>
  )
}
