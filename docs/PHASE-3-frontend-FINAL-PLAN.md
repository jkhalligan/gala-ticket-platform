# Phase 3: Dashboards & Table Management - FINAL PLAN
**Date:** December 10, 2025  
**Status:** Ready for Implementation  
**Decisions:** All confirmed ✅

---

## 🎯 Phase 3 Overview

**Goal:** Build post-checkout experience with table and ticket dashboards

**Priority Order:**
1. 🔴 **Table Onboarding Flow** (immediately after purchase)
2. 🔴 **Table Dashboard** (comprehensive management)
3. 🟡 **Tickets Dashboard** (after table dashboard complete)
4. 🟢 **Polish & Mobile Optimization**

**Estimated Time:** 3-4 weeks (full implementation)

---

## ✅ Confirmed Decisions

### 1. Table Setup Flow
**Answer:** Onboarding flow immediately after purchase + edit later

**Implementation:**
```
Payment Success
    ↓
Modal/Page: "Customize Your Table"
    ↓
┌─────────────────────────────────────┐
│ Table Name: [input]                 │
│ Custom Slug (optional): [input]     │
│ Welcome Message: [textarea]         │
│                                      │
│ [Skip for Now]  [Save & Continue]   │
└─────────────────────────────────────┘
    ↓
Redirect to Table Dashboard
```

### 2. Guest Invitation Methods
**Answer:** Both email-based AND shareable link

**Implementation:**
- Shareable public link: `/dashboard/table/[slug]`
- Email invitation form in dashboard
- Per-seat actions depend on table type

### 3. Seat Action Buttons
**Answer:** Button functionality depends on table type

**PREPAID Tables (Host paid for all seats):**
- Button: **"Claim Seat"**
- Action: Free assignment, no payment
- Flow: Click → Fill name/email → Seat claimed

**CAPTAIN_PAYG Tables (Pay-as-you-go):**
- Button: **"Purchase Seat"**  
- Action: Requires payment via Stripe
- Flow: Click → Checkout → Payment → Seat assigned

### 4. Dashboard Access Control
**Answer:** Public link with role-based permissions

**Access Levels:**
- 🌐 **Public:** Anyone with link can VIEW
- 👤 **Guest:** Can edit own details (name, dietary restrictions)
- 👑 **Owner/Captain:** Full edit permissions for all guests
- 🛡️ **Admin:** All permissions across all tables

### 5. Dashboard Build Priority
**Answer:** Table dashboard first, then tickets dashboard

**Sequence:**
1. Week 1-2: Table dashboard complete
2. Week 3: Tickets dashboard
3. Week 4: Polish & mobile optimization

### 6. Guest Self-Service
**Answer:** Yes, guests can always edit their own details

**Permissions:**
- ✅ Guest: Edit own name, dietary restrictions
- ✅ Owner/Captain: Edit any guest's details
- ✅ Admin: Edit any guest's details

### 7. Mobile Experience
**Answer:** Mobile dashboard is a priority

**Requirements:**
- Mobile-first design for all dashboards
- Touch-friendly buttons (44×44px minimum)
- Responsive table layouts (stack on mobile)
- Bottom sheet for guest details on mobile

### 8. Multiple Tables Per Owner
**Answer:** Each table has own dashboard, owner can switch between

**Implementation:**
- Each table: Unique slug + separate dashboard
- Dashboard header: Dropdown to switch tables
- Format: "My Tables: Smith Table, Johnson Table, Williams Table"
- Each shareable link independent

### 9. Multiple Tickets Per Purchaser
**Answer:** All tickets on one tickets dashboard

**Implementation:**
- Single `/dashboard/tickets` page
- Shows all tickets for logged-in user
- Card-based layout (one card per ticket)
- Group by event (if multiple events)

---

## 🏗️ Phase 3 Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│ Payment Success (Webhook)                           │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    FULL_TABLE    INDIVIDUAL_TICKET
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ Create Table  │  │ Create Guest     │
│ - Generate    │  │ Assignment       │
│   slug        │  │ - Link to order  │
│ - Set owner   │  │ - Create ticket  │
│ - Initialize  │  │                  │
└───────┬───────┘  └────────┬─────────┘
        │                   │
        ▼                   ▼
┌───────────────┐  ┌──────────────────┐
│ Table Setup   │  │ Tickets          │
│ Onboarding    │  │ Dashboard        │
│ Modal         │  │ /dashboard/      │
│               │  │ tickets          │
└───────┬───────┘  └──────────────────┘
        │
        ▼
┌───────────────┐
│ Table         │
│ Dashboard     │
│ /dashboard/   │
│ table/[slug]  │
└───────────────┘
```

---

## 📋 Phase 3 Implementation Plan

### Priority 1: Post-Checkout Flow (Week 1, Days 1-2)

#### 1.1 Webhook Handler Enhancement

**File:** `src/app/api/webhooks/stripe/route.ts`

**Add logic for FULL_TABLE purchases:**

```typescript
if (product.kind === 'FULL_TABLE') {
  // Generate table slug
  const tableSlug = await generateUniqueTableSlug(
    `${buyer.first_name}-${buyer.last_name}-table`
  );
  
  // Create Table record
  const table = await prisma.table.create({
    data: {
      event_id: order.event_id,
      organization_id: product.event.organization_id,
      primary_owner_id: buyer.id,
      name: `${buyer.first_name} ${buyer.last_name}'s Table`,
      slug: tableSlug,
      type: 'PREPAID',
      status: 'ACTIVE',
      capacity: 10, // Or from product
      custom_total_price_cents: order.amount_cents,
      payment_status: 'PAID_OFFLINE',
      reference_code: await generateTableReferenceCode(org.id),
    },
  });
  
  // Add owner role
  await prisma.tableUserRole.create({
    data: {
      table_id: table.id,
      user_id: buyer.id,
      role: 'OWNER',
    },
  });
  
  // Link order to table
  await prisma.order.update({
    where: { id: order.id },
    data: { table_id: table.id },
  });
  
  // Store table slug for redirect
  metadata.table_slug = table.slug;
}
```

**Add logic for INDIVIDUAL_TICKET purchases:**

```typescript
if (product.kind === 'INDIVIDUAL_TICKET') {
  // Create GuestAssignment for each ticket
  for (let i = 0; i < order.quantity; i++) {
    await prisma.guestAssignment.create({
      data: {
        event_id: order.event_id,
        organization_id: product.event.organization_id,
        user_id: buyer.id,
        order_id: order.id,
        tier: product.tier,
        reference_code: await generateGuestReferenceCode(org.id),
        // table_id: null (not assigned to table yet)
      },
    });
  }
}
```

**Testing:**
- [ ] FULL_TABLE purchase creates Table record
- [ ] Table has correct owner role
- [ ] INDIVIDUAL_TICKET creates correct number of GuestAssignments
- [ ] Orders link to tables correctly

---

#### 1.2 Success Screen with Redirect

**File:** `src/components/public/checkout/SuccessScreen.tsx`

**Update to show setup flow:**

```typescript
export function SuccessScreen({ 
  orderData 
}: { 
  orderData: {
    order_id: string;
    product_kind: 'FULL_TABLE' | 'INDIVIDUAL_TICKET';
    table_slug?: string;
  }
}) {
  const [showSetup, setShowSetup] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  useEffect(() => {
    if (orderData.product_kind === 'FULL_TABLE') {
      // Show table setup modal after 2 seconds
      const timer = setTimeout(() => setShowSetup(true), 2000);
      return () => clearTimeout(timer);
    } else {
      // Redirect to tickets dashboard after 3 seconds
      const timer = setTimeout(() => {
        setIsRedirecting(true);
        window.location.href = '/dashboard/tickets';
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [orderData]);
  
  return (
    <div>
      {/* Success message */}
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <h1>Payment Successful!</h1>
        <p>Order #{orderData.order_id}</p>
      </div>
      
      {/* Table setup modal */}
      {showSetup && orderData.product_kind === 'FULL_TABLE' && (
        <TableSetupModal 
          tableSlug={orderData.table_slug!}
          onComplete={() => {
            window.location.href = `/dashboard/table/${orderData.table_slug}`;
          }}
          onSkip={() => {
            window.location.href = `/dashboard/table/${orderData.table_slug}`;
          }}
        />
      )}
      
      {/* Redirect message */}
      {isRedirecting && (
        <p>Redirecting to your dashboard...</p>
      )}
    </div>
  );
}
```

**Testing:**
- [ ] FULL_TABLE: Setup modal appears after 2 seconds
- [ ] INDIVIDUAL_TICKET: Redirects to tickets dashboard
- [ ] Skip button works in setup modal
- [ ] Save button proceeds to dashboard

---

#### 1.3 Table Setup Modal

**File:** `src/components/dashboard/TableSetupModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function TableSetupModal({
  tableSlug,
  onComplete,
  onSkip,
}: {
  tableSlug: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [tableName, setTableName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSave = async () => {
    setLoading(true);
    
    try {
      await fetch(`/api/tables/${tableSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tableName || undefined,
          slug: customSlug || undefined,
          welcome_message: welcomeMessage || undefined,
        }),
      });
      
      onComplete();
    } catch (error) {
      console.error('Failed to update table:', error);
      alert('Failed to save table settings');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Your Table</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="tableName">Table Name</Label>
            <Input
              id="tableName"
              placeholder="Smith Family Table"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-1">
              This will be displayed to your guests
            </p>
          </div>
          
          <div>
            <Label htmlFor="customSlug">Custom URL (optional)</Label>
            <Input
              id="customSlug"
              placeholder="smith-family"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Your table URL: /dashboard/table/{customSlug || tableSlug}
            </p>
          </div>
          
          <div>
            <Label htmlFor="welcomeMessage">Welcome Message (optional)</Label>
            <Textarea
              id="welcomeMessage"
              placeholder="Welcome to our table! We're excited to celebrate with you."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={loading}
            >
              Skip for Now
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Testing:**
- [ ] Modal appears with empty form
- [ ] Table name field updates
- [ ] Custom slug field updates URL preview
- [ ] Welcome message textarea works
- [ ] Skip button redirects without saving
- [ ] Save button updates table and redirects
- [ ] Mobile responsive

---

### Priority 2: Table Dashboard (Week 1-2)

#### 2.1 Table Dashboard Route

**File:** `src/app/dashboard/table/[slug]/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TableDashboard } from '@/components/dashboard/TableDashboard';

export default async function TableDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Fetch table with all related data
  const table = await prisma.table.findUnique({
    where: { slug },
    include: {
      event: true,
      primary_owner: true,
      user_roles: {
        include: { user: true },
      },
      guest_assignments: {
        include: {
          user: true,
          order: true,
        },
        orderBy: { created_at: 'asc' },
      },
      orders: {
        include: {
          user: true,
        },
      },
    },
  });
  
  if (!table) {
    redirect('/dashboard');
  }
  
  // Get current user (public dashboard, so may be null)
  const currentUser = await getCurrentUser();
  
  // Determine user's role
  const userRole = currentUser
    ? table.user_roles.find(r => r.user_id === currentUser.id)?.role
    : null;
  
  const isOwner = currentUser?.id === table.primary_owner_id;
  const isAdmin = currentUser?.isAdmin;
  const canEdit = isOwner || isAdmin;
  
  return (
    <TableDashboard
      table={table}
      currentUser={currentUser}
      userRole={userRole}
      canEdit={canEdit}
    />
  );
}
```

---

#### 2.2 Table Dashboard Component

**File:** `src/components/dashboard/TableDashboard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Edit, Users } from 'lucide-react';
import { TableOverviewCard } from './TableOverviewCard';
import { GuestListCard } from './GuestListCard';
import { InviteLinkCard } from './InviteLinkCard';
import { TableSwitcher } from './TableSwitcher';

export function TableDashboard({
  table,
  currentUser,
  userRole,
  canEdit,
}: TableDashboardProps) {
  // Calculate stats
  const totalSeats = table.capacity;
  const filledSeats = table.guest_assignments.length;
  const emptySeats = totalSeats - filledSeats;
  const fillPercentage = Math.round((filledSeats / totalSeats) * 100);
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header with table switcher */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{table.name}</h1>
          <p className="text-muted-foreground">
            {table.event.name} • {new Date(table.event.event_date).toLocaleDateString()}
          </p>
        </div>
        
        {canEdit && (
          <TableSwitcher 
            currentTableId={table.id}
            currentUser={currentUser}
          />
        )}
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Seats Filled</p>
              <p className="text-2xl font-bold">{filledSeats}/{totalSeats}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Fill Percentage</p>
            <div className="mt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all"
                  style={{ width: `${fillPercentage}%` }}
                />
              </div>
              <p className="text-right text-sm mt-1">{fillPercentage}%</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div>
            <p className="text-sm text-muted-foreground">Table Status</p>
            <p className="text-xl font-semibold mt-1">
              {emptySeats === 0 ? '✅ Full' : `${emptySeats} seats available`}
            </p>
          </div>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <TableOverviewCard 
            table={table}
            canEdit={canEdit}
          />
          
          <GuestListCard
            table={table}
            currentUser={currentUser}
            canEdit={canEdit}
          />
        </div>
        
        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          <InviteLinkCard
            tableSlug={table.slug}
            tableName={table.name}
          />
          
          {canEdit && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Table Details
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Share2 className="w-4 h-4 mr-2" />
                  Send Email Invitations
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

#### 2.3 Guest List with Seat Actions

**File:** `src/components/dashboard/GuestListCard.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, ShoppingCart, Check } from 'lucide-react';

export function GuestListCard({
  table,
  currentUser,
  canEdit,
}: GuestListCardProps) {
  const isPrepaid = table.type === 'PREPAID';
  const isCaptain = table.type === 'CAPTAIN_PAYG';
  
  // Create array of seats (filled + empty)
  const seats = Array.from({ length: table.capacity }, (_, i) => {
    const guest = table.guest_assignments[i];
    return {
      number: i + 1,
      guest: guest || null,
      isEmpty: !guest,
    };
  });
  
  const handleClaimSeat = async (seatNumber: number) => {
    // Open modal to collect guest details, then claim seat
  };
  
  const handlePurchaseSeat = async (seatNumber: number) => {
    // Redirect to checkout for this table
    window.location.href = `/checkout?table=${table.slug}&tier=${table.tier}`;
  };
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Guest List</h2>
        {canEdit && (
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Guest
          </Button>
        )}
      </div>
      
      {/* Desktop: Table layout */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 gap-4">
          {seats.map((seat) => (
            <div
              key={seat.number}
              className="border rounded-lg p-4 hover:border-primary transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {seat.number}
                  </div>
                  
                  {seat.guest ? (
                    <div>
                      <p className="font-medium">
                        {seat.guest.user.first_name} {seat.guest.user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {seat.guest.user.email}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Empty Seat</p>
                  )}
                </div>
                
                {seat.isEmpty && (
                  <div>
                    {isPrepaid && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleClaimSeat(seat.number)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Claim Seat
                      </Button>
                    )}
                    
                    {isCaptain && (
                      <Button 
                        size="sm"
                        onClick={() => handlePurchaseSeat(seat.number)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Purchase Seat
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {seat.guest && seat.guest.dietary_restrictions && (
                <p className="text-sm text-muted-foreground mt-2">
                  Dietary: {seat.guest.dietary_restrictions}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Mobile: List layout */}
      <div className="md:hidden space-y-3">
        {seats.map((seat) => (
          <Card key={seat.number} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                  {seat.number}
                </div>
                
                <div className="min-w-0">
                  {seat.guest ? (
                    <>
                      <p className="font-medium truncate">
                        {seat.guest.user.first_name} {seat.guest.user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {seat.guest.user.email}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Empty Seat</p>
                  )}
                </div>
              </div>
              
              {seat.isEmpty && (
                <div className="shrink-0">
                  {isPrepaid && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleClaimSeat(seat.number)}
                    >
                      Claim
                    </Button>
                  )}
                  
                  {isCaptain && (
                    <Button 
                      size="sm"
                      onClick={() => handlePurchaseSeat(seat.number)}
                    >
                      Buy
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
```

**Key Features:**
- ✅ Shows all seats (filled + empty)
- ✅ **PREPAID tables**: "Claim Seat" button (free)
- ✅ **CAPTAIN_PAYG tables**: "Purchase Seat" button (redirects to checkout)
- ✅ Mobile: Vertical list layout
- ✅ Desktop: 2-column grid layout

---

#### 2.4 Table Switcher for Multiple Tables

**File:** `src/components/dashboard/TableSwitcher.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export function TableSwitcher({
  currentTableId,
  currentUser,
}: {
  currentTableId: string;
  currentUser: any;
}) {
  const router = useRouter();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch all tables owned by current user
    fetch('/api/users/me/tables')
      .then(res => res.json())
      .then(data => {
        setTables(data.tables);
        setLoading(false);
      });
  }, []);
  
  if (loading || tables.length <= 1) {
    return null; // Don't show switcher if only one table
  }
  
  return (
    <Select
      value={currentTableId}
      onValueChange={(tableId) => {
        const table = tables.find(t => t.id === tableId);
        if (table) {
          router.push(`/dashboard/table/${table.slug}`);
        }
      }}
    >
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Switch Table" />
      </SelectTrigger>
      <SelectContent>
        {tables.map((table) => (
          <SelectItem key={table.id} value={table.id}>
            {table.name} ({table.guest_assignments.length}/{table.capacity} filled)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**API Route needed:**
```typescript
// src/app/api/users/me/tables/route.ts
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const tables = await prisma.table.findMany({
    where: { primary_owner_id: user.id },
    include: {
      guest_assignments: true,
      event: true,
    },
  });
  
  return NextResponse.json({ tables });
}
```

---

### Priority 3: Tickets Dashboard (Week 3)

#### 3.1 Tickets Dashboard Route

**File:** `src/app/dashboard/tickets/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TicketsDashboard } from '@/components/dashboard/TicketsDashboard';

export default async function TicketsDashboardPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login?redirect=/dashboard/tickets');
  }
  
  // Fetch all tickets for this user
  const guestAssignments = await prisma.guestAssignment.findMany({
    where: { user_id: user.id },
    include: {
      event: true,
      table: true,
      order: true,
    },
    orderBy: { created_at: 'desc' },
  });
  
  return (
    <TicketsDashboard
      user={user}
      tickets={guestAssignments}
    />
  );
}
```

---

#### 3.2 Tickets Dashboard Component

**File:** `src/components/dashboard/TicketsDashboard.tsx`

```typescript
'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Edit, Send } from 'lucide-react';
import { TicketCard } from './TicketCard';

export function TicketsDashboard({
  user,
  tickets,
}: {
  user: any;
  tickets: any[];
}) {
  // Group tickets by event
  const ticketsByEvent = tickets.reduce((acc, ticket) => {
    const eventId = ticket.event_id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: ticket.event,
        tickets: [],
      };
    }
    acc[eventId].tickets.push(ticket);
    return acc;
  }, {});
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Tickets</h1>
        <p className="text-muted-foreground">
          You have {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      {Object.values(ticketsByEvent).map((group: any) => (
        <div key={group.event.id} className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {group.event.name}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {new Date(group.event.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' at '}
            {group.event.venue_name}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.tickets.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </div>
      ))}
      
      {tickets.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            You don't have any tickets yet
          </p>
          <Button>Browse Events</Button>
        </Card>
      )}
    </div>
  );
}
```

---

#### 3.3 Individual Ticket Card

**File:** `src/components/dashboard/TicketCard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Edit, Send, MapPin } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function TicketCard({ ticket }: { ticket: any }) {
  const [showQR, setShowQR] = useState(false);
  
  const tierColor = {
    STANDARD: 'bg-gray-500',
    VIP: 'bg-purple-500',
    VVIP: 'bg-gold-500',
  }[ticket.tier] || 'bg-gray-500';
  
  return (
    <Card className="overflow-hidden">
      {/* Tier banner */}
      <div className={`${tierColor} text-white px-4 py-2`}>
        <p className="font-semibold">{ticket.tier} Ticket</p>
      </div>
      
      <div className="p-4 space-y-3">
        {/* Guest name */}
        <div>
          <p className="text-sm text-muted-foreground">Guest Name</p>
          <p className="font-medium">
            {ticket.display_name || 
             `${ticket.user.first_name} ${ticket.user.last_name}`}
          </p>
        </div>
        
        {/* Table assignment */}
        {ticket.table && (
          <div>
            <p className="text-sm text-muted-foreground">Table Assignment</p>
            <Button
              variant="link"
              className="p-0 h-auto font-medium"
              onClick={() => {
                window.location.href = `/dashboard/table/${ticket.table.slug}`;
              }}
            >
              {ticket.table.name}
            </Button>
          </div>
        )}
        
        {/* Dietary restrictions */}
        {ticket.dietary_restrictions && (
          <div>
            <p className="text-sm text-muted-foreground">Dietary Restrictions</p>
            <p className="text-sm">{ticket.dietary_restrictions}</p>
          </div>
        )}
        
        {/* QR Code */}
        {showQR ? (
          <div className="flex justify-center py-4">
            <QRCodeSVG
              value={ticket.reference_code}
              size={150}
              level="H"
            />
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowQR(true)}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Show QR Code
          </Button>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <Send className="w-4 h-4 mr-2" />
            Transfer
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

**Features:**
- ✅ Shows ticket tier with color-coded header
- ✅ Guest name (editable)
- ✅ Table assignment (if applicable) with link
- ✅ Dietary restrictions display
- ✅ QR code for check-in
- ✅ Edit and transfer buttons
- ✅ Mobile-optimized card layout

---

## 🔐 Access Control & Permissions

### Permission Matrix

| Action | Guest | Owner/Captain | Admin |
|--------|-------|---------------|-------|
| **View table** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Edit own guest details** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Edit other guest details** | ❌ No | ✅ Yes | ✅ Yes |
| **Add guests** | ❌ No | ✅ Yes | ✅ Yes |
| **Remove guests** | ❌ No | ✅ Yes | ✅ Yes |
| **Edit table name** | ❌ No | ✅ Yes | ✅ Yes |
| **Share invite link** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Claim seat (PREPAID)** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Purchase seat (CAPTAIN)** | ✅ Yes | ✅ Yes | ✅ Yes |

### Implementation

```typescript
// Check permissions
function canEditGuest(
  currentUser: User | null,
  guest: GuestAssignment,
  table: Table
): boolean {
  if (!currentUser) return false;
  
  // Can edit own details
  if (currentUser.id === guest.user_id) return true;
  
  // Owner/Captain can edit all
  if (currentUser.id === table.primary_owner_id) return true;
  
  // Admin can edit all
  if (currentUser.isAdmin) return true;
  
  return false;
}
```

---

## 📱 Mobile Optimization

### Mobile-First Design Principles

1. **Touch Targets:** Min 44×44px for all interactive elements
2. **Responsive Layouts:** Stack on mobile, grid on desktop
3. **Bottom Sheets:** Use for forms and details on mobile
4. **Horizontal Scroll:** Avoid where possible
5. **Fixed Headers:** Keep table switcher and nav visible

### Mobile Layouts

**Desktop (≥768px):**
- 2-column guest list grid
- Sidebar for invite link
- Table switcher dropdown

**Mobile (<768px):**
- Single-column guest list
- Collapsible sections
- Bottom sheet for guest details
- Hamburger menu for actions

### Example Mobile Component

```typescript
// Use media query hook
import { useMediaQuery } from '@/hooks/use-media-query';

export function ResponsiveGuestList() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return isMobile ? (
    <MobileGuestList />
  ) : (
    <DesktopGuestList />
  );
}
```

---

## 🧪 Testing Checklist

### Phase 3 Testing

**Post-Checkout Flow:**
- [ ] FULL_TABLE purchase creates Table record
- [ ] Table setup modal appears after payment
- [ ] Skip button works, redirects to dashboard
- [ ] Save button updates table, redirects to dashboard
- [ ] INDIVIDUAL_TICKET purchase creates GuestAssignment
- [ ] Tickets redirect to `/dashboard/tickets`

**Table Dashboard:**
- [ ] Table details display correctly
- [ ] Guest list shows all seats (filled + empty)
- [ ] PREPAID tables show "Claim Seat" button
- [ ] CAPTAIN_PAYG tables show "Purchase Seat" button
- [ ] Claim seat flow works (collect name/email)
- [ ] Purchase seat redirects to checkout
- [ ] Table switcher appears if user owns multiple tables
- [ ] Invite link copies to clipboard
- [ ] Mobile responsive (stack layout)

**Tickets Dashboard:**
- [ ] All tickets display in cards
- [ ] Tickets grouped by event
- [ ] QR code displays correctly
- [ ] Edit details button works
- [ ] Transfer button works
- [ ] Table link redirects correctly
- [ ] Mobile responsive (single column)

**Permissions:**
- [ ] Public can view table
- [ ] Guest can edit own details only
- [ ] Owner can edit all guests
- [ ] Admin can edit all guests
- [ ] Unauthorized actions blocked

---

## 📊 Phase 3 Timeline

### Week 1: Core Infrastructure (10-12 hours)
- **Days 1-2:** Webhook handler, redirect logic
- **Days 3-4:** Table setup modal
- **Day 5:** Testing & fixes

### Week 2: Table Dashboard (15-20 hours)
- **Days 1-2:** Table dashboard route & layout
- **Days 3-4:** Guest list with seat actions
- **Day 5:** Invite link, table switcher
- **Days 6-7:** Mobile optimization, testing

### Week 3: Tickets Dashboard (10-12 hours)
- **Days 1-2:** Tickets dashboard route & layout
- **Days 3-4:** Ticket cards with QR codes
- **Day 5:** Edit & transfer functionality
- **Days 6-7:** Mobile optimization, testing

### Week 4: Polish & Launch (8-10 hours)
- **Days 1-2:** Bug fixes from testing
- **Days 3-4:** Performance optimization
- **Day 5:** Final testing & documentation
- **Days 6-7:** Production deployment

**Total Estimated Time:** 43-54 hours (3-4 weeks full-time)

---

## 🚀 Success Criteria

Phase 3 is complete when:

✅ User completes FULL_TABLE purchase
✅ Table setup modal appears, allows customization
✅ User redirected to `/dashboard/table/[slug]`
✅ Table dashboard shows all seats with correct actions
✅ PREPAID table: "Claim Seat" button works
✅ CAPTAIN_PAYG table: "Purchase Seat" redirects to checkout
✅ Guest can claim seat and see their details
✅ Owner can edit any guest's details
✅ Invite link copies and works when shared
✅ User with multiple tables can switch between them
✅ User completes INDIVIDUAL_TICKET purchase
✅ User redirected to `/dashboard/tickets`
✅ All tickets display with correct details
✅ QR codes generate and display correctly
✅ User can edit their own guest details
✅ Mobile responsive on all screens
✅ All permissions enforced correctly

---

## 📝 API Routes to Create

1. ✅ `GET /api/tables/[slug]` - Exists
2. ✅ `PATCH /api/tables/[slug]` - Exists
3. **NEW:** `GET /api/users/me/tables` - List tables owned by user
4. **NEW:** `POST /api/tables/[slug]/claim-seat` - Claim seat on PREPAID table
5. **NEW:** `PATCH /api/guest-assignments/[id]` - Edit guest details
6. **NEW:** `POST /api/tickets/[id]/transfer` - Transfer ticket
7. **NEW:** `GET /api/users/me/tickets` - Alternative to guest assignments query

---

## 🎯 Next Steps

To start Phase 3 implementation:

1. **Commit Phase 2 code**
2. **Create new branch:** `git checkout -b phase-3-dashboards`
3. **Start with Priority 1:** Webhook handler & redirect logic
4. **Reference this document** for all implementation details
5. **Test incrementally** - don't wait until the end

---

**Document Version:** 1.0  
**Last Updated:** December 10, 2025  
**Status:** Ready for Implementation ✅  
**All Decisions Confirmed:** ✅
