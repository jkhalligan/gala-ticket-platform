# Brand Color System - Implementation Guide

## Overview
This guide shows you how to add a flexible brand color system to your Pink Gala platform. Admins can define color presets (Brand 1, Brand 2, etc.) and assign them to ticket tiers and tables, which dynamically themes dashboards and confetti animations.

## Step 1: Update Prisma Schema

Add these models to your `prisma/schema.prisma`:

```prisma
model BrandColor {
  id          String   @id @default(cuid())
  eventId     String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  // Identification
  name        String   // "Brand 1", "Brand 2", "Brand 3"
  displayName String   // "Corporate Gold", "VIP Pink"
  
  // Color values (hex codes)
  primary     String   // Main brand color: "#D4AF37"
  secondary   String   // Light background: "#FFF8DC"
  accent      String   // Dark accents: "#B8860B"
  
  // Animation colors
  confettiColors String[] // Array of hex codes for confetti
  
  // Relations
  ticketTiers TicketTier[]
  tables      Table[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([eventId, name])
  @@index([eventId])
}

// Update existing Event model
model Event {
  // ... existing fields
  brandColors BrandColor[]
  ticketTiers TicketTier[]
}

// Update existing TicketTier model
model TicketTier {
  // ... existing fields
  
  // NEW: Link to brand color
  brandColorId  String?
  brandColor    BrandColor? @relation(fields: [brandColorId], references: [id], onDelete: SetNull)
}

// Update existing Table model
model Table {
  // ... existing fields
  
  // NEW: Optional custom brand color override
  brandColorId  String?
  brandColor    BrandColor? @relation(fields: [brandColorId], references: [id], onDelete: SetNull)
}
```

## Step 2: Create Migration

```bash
npx prisma migrate dev --name add_brand_color_system
```

## Step 3: Seed Default Brand Colors

Create or update `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_BRANDS = [
  {
    name: "Brand 1",
    displayName: "Corporate Gold",
    primary: "#D4AF37",
    secondary: "#FFF8DC",
    accent: "#B8860B",
    confettiColors: ["#D4AF37", "#FFD700", "#FFF8DC", "#F0E68C"]
  },
  {
    name: "Brand 2",
    displayName: "VIP Hot Pink",
    primary: "#FF1493",
    secondary: "#FFE4F1",
    accent: "#C71585",
    confettiColors: ["#FF1493", "#FF69B4", "#FFB6C1", "#FFC0CB"]
  },
  {
    name: "Brand 3",
    displayName: "VVIP Purple",
    primary: "#9370DB",
    secondary: "#E6E6FA",
    accent: "#663399",
    confettiColors: ["#9370DB", "#BA55D3", "#DDA0DD", "#E6E6FA"]
  },
  {
    name: "Brand 4",
    displayName: "Standard Teal",
    primary: "#20B2AA",
    secondary: "#E0F2F1",
    accent: "#008B8B",
    confettiColors: ["#20B2AA", "#48D1CC", "#AFEEEE", "#E0FFFF"]
  }
]

async function main() {
  // Find or create Pink Gala event
  const event = await prisma.event.upsert({
    where: { slug: 'pink-gala-50th' },
    update: {},
    create: {
      name: '50th Anniversary Pink Gala',
      slug: 'pink-gala-50th',
      // ... other event fields
    }
  })

  // Create brand colors
  for (const brand of DEFAULT_BRANDS) {
    await prisma.brandColor.upsert({
      where: {
        eventId_name: {
          eventId: event.id,
          name: brand.name
        }
      },
      update: brand,
      create: {
        ...brand,
        eventId: event.id
      }
    })
  }

  console.log('✅ Brand colors seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Run the seed:
```bash
npx prisma db seed
```

## Step 4: Create Admin Interface

Create `app/(admin)/admin/events/[eventId]/branding/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { BrandColorManager } from '@/components/admin/BrandColorManager'
import { TicketTierAssignments } from '@/components/admin/TicketTierAssignments'

export default async function BrandingPage({ 
  params 
}: { 
  params: { eventId: string } 
}) {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    include: {
      brandColors: true,
      ticketTiers: {
        include: { brandColor: true }
      }
    }
  })

  if (!event) {
    return <div>Event not found</div>
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Event Branding</h1>
        <p className="text-muted-foreground">
          Customize colors for {event.name}
        </p>
      </div>

      <BrandColorManager 
        eventId={event.id} 
        brandColors={event.brandColors} 
      />

      <TicketTierAssignments
        ticketTiers={event.ticketTiers}
        brandColors={event.brandColors}
      />
    </div>
  )
}
```

## Step 5: Brand Color Manager Component

Create `components/admin/BrandColorManager.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { BrandColor } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface Props {
  eventId: string
  brandColors: BrandColor[]
}

export function BrandColorManager({ eventId, brandColors }: Props) {
  const [colors, setColors] = useState(brandColors)
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Brand Colors</h2>
        <Button onClick={() => {/* Open create modal */}}>
          <Plus className="w-4 h-4 mr-2" />
          Add Brand Color
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {colors.map((brand) => (
          <Card key={brand.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{brand.displayName}</CardTitle>
                <p className="text-sm text-muted-foreground">{brand.name}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setEditing(brand.id)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {/* Delete handler */}}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <ColorSwatch label="Primary" color={brand.primary} />
                <ColorSwatch label="Secondary" color={brand.secondary} />
                <ColorSwatch label="Accent" color={brand.accent} />
                
                <div>
                  <Label className="text-xs">Confetti Colors</Label>
                  <div className="flex gap-1 mt-1">
                    {brand.confettiColors.map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div 
        className="w-12 h-12 rounded border"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <p className="font-mono text-sm">{color}</p>
      </div>
    </div>
  )
}
```

## Step 6: Ticket Tier Assignment Component

Create `components/admin/TicketTierAssignments.tsx`:

```typescript
'use client'

import { BrandColor, TicketTier } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  ticketTiers: (TicketTier & { brandColor?: BrandColor | null })[]
  brandColors: BrandColor[]
}

export function TicketTierAssignments({ ticketTiers, brandColors }: Props) {
  const handleAssignment = async (tierId: string, brandColorId: string) => {
    // Call your API to update the ticket tier
    await fetch(`/api/admin/ticket-tiers/${tierId}`, {
      method: 'PATCH',
      body: JSON.stringify({ brandColorId })
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Tier Brand Assignments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ticketTiers.map((tier) => (
            <div key={tier.id} className="flex items-center gap-4">
              <div className="w-32 font-medium">{tier.name}</div>
              <Select
                value={tier.brandColorId || 'none'}
                onValueChange={(value) => handleAssignment(tier.id, value)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No brand color</SelectItem>
                  {brandColors.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: brand.primary }}
                        />
                        {brand.displayName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {tier.brandColor && (
                <div className="flex gap-1">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: tier.brandColor.primary }}
                  />
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: tier.brandColor.secondary }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

## Step 7: Apply Colors in Table Dashboard

Update `app/(authenticated)/dashboard/table/[slug]/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { TableDashboardClient } from '@/components/dashboard/TableDashboardClient'

export default async function TableDashboard({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const table = await prisma.table.findUnique({
    where: { slug: params.slug },
    include: {
      brandColor: true,
      host: true,
      guests: {
        include: { 
          ticket: {
            include: {
              tier: {
                include: { brandColor: true }
              }
            }
          }
        }
      },
      event: {
        include: { brandColors: true }
      }
    }
  })

  if (!table) {
    return <div>Table not found</div>
  }

  // Determine brand color with fallback chain
  const brandColor = 
    table.brandColor || 
    table.guests[0]?.ticket?.tier?.brandColor || 
    table.event.brandColors[0]

  return (
    <TableDashboardClient 
      table={table} 
      brandColor={brandColor}
    />
  )
}
```

## Step 8: Client Component with Dynamic Styling

Create `components/dashboard/TableDashboardClient.tsx`:

```typescript
'use client'

import { BrandColor } from '@prisma/client'
import { CelebrateButton } from './CelebrateButton'

interface Props {
  table: any // Your full table type
  brandColor: BrandColor
}

export function TableDashboardClient({ table, brandColor }: Props) {
  return (
    <div 
      style={{
        '--brand-primary': brandColor.primary,
        '--brand-secondary': brandColor.secondary,
        '--brand-accent': brandColor.accent,
      } as React.CSSProperties}
      className="min-h-screen"
    >
      {/* Header */}
      <header className="bg-[var(--brand-secondary)] border-b-4 border-[var(--brand-primary)]">
        <div className="container py-8">
          <h1 className="text-4xl font-bold text-[var(--brand-primary)]">
            {table.name}
          </h1>
          <p className="text-[var(--brand-accent)]">
            Hosted by {table.host.name}
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Guest list */}
          <div className="md:col-span-2">
            {/* Your existing guest list UI */}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Progress widget with brand colors */}
            <div className="rounded-lg border p-4 bg-[var(--brand-secondary)]">
              <h3 className="text-[var(--brand-primary)] font-semibold mb-2">
                Progress
              </h3>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all"
                  style={{ 
                    width: `${(table.seatsFilled / 10) * 100}%`,
                    backgroundColor: brandColor.primary
                  }}
                />
              </div>
            </div>

            {/* Celebrate button */}
            <CelebrateButton confettiColors={brandColor.confettiColors} />
          </div>
        </div>
      </main>
    </div>
  )
}
```

## Step 9: Confetti with Dynamic Colors

Create `components/dashboard/CelebrateButton.tsx`:

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import confetti from 'canvas-confetti'

interface Props {
  confettiColors: string[]
}

export function CelebrateButton({ confettiColors }: Props) {
  const celebrate = () => {
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: confettiColors // Dynamic colors!
      })
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: confettiColors
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }

  return (
    <Button 
      onClick={celebrate}
      size="lg"
      className="w-full"
      style={{ backgroundColor: 'var(--brand-primary)' }}
    >
      <Sparkles className="w-5 h-5 mr-2" />
      Celebrate! 🎉
    </Button>
  )
}
```

## Step 10: API Routes

Create `app/api/admin/ticket-tiers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { brandColorId } = await req.json()

    const updatedTier = await prisma.ticketTier.update({
      where: { id: params.id },
      data: { brandColorId }
    })

    return NextResponse.json(updatedTier)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update ticket tier' },
      { status: 500 }
    )
  }
}
```

## Summary of Benefits

✅ **Admin Control:** Easily manage brand colors from admin panel
✅ **Consistency:** Predefined color sets prevent visual chaos
✅ **Flexibility:** Can assign different brands to different ticket tiers
✅ **Multi-tenant Ready:** Each event has its own brand colors
✅ **Dynamic:** Changes apply immediately to all dashboards
✅ **Developer-Friendly:** Type-safe with Prisma types

## Next Steps

1. Run the migration
2. Seed the default brand colors
3. Build the admin UI
4. Update table dashboard to use dynamic colors
5. Test with different brand assignments
6. Add color picker UI for creating custom brands
