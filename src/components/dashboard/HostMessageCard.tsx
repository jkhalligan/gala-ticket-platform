// Component: HostMessageCard
// Shows the welcome message from the table host with styled accent

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HostMessageCardProps {
  welcomeMessage: string
  hostName: string
}

export function HostMessageCard({ welcomeMessage, hostName }: HostMessageCardProps) {
  return (
    <Card
      className="border-l-4"
      style={{ borderLeftColor: 'var(--table-accent-color, hsl(var(--primary)))' }}
    >
      <CardHeader>
        <CardTitle
          className="text-sm font-medium uppercase"
          style={{ color: 'var(--table-accent-color, hsl(var(--primary)))' }}
        >
          Message from {hostName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="italic text-muted-foreground">"{welcomeMessage}"</p>
      </CardContent>
    </Card>
  )
}
